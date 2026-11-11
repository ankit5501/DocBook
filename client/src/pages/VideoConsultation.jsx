import { useState, useEffect, useRef, useContext, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../api/axios';
import { AuthContext } from '../context/AuthContext';
import { io } from 'socket.io-client';
import { toast } from 'react-toastify';

const VideoConsultation = () => {
  const { appointmentId } = useParams();
  const navigate = useNavigate();
  const { user } = useContext(AuthContext);

  const [appointment, setAppointment] = useState(null);
  const [patientProfile, setPatientProfile] = useState(null);
  const [loading, setLoading] = useState(true);

  // Timing check state
  const [timeState, setTimeState] = useState({
    canJoin: false,
    startsInMinutes: null,
    unlocksAtText: '',
    slotFormatted: ''
  });

  // Call Controls State
  const [isMuted, setIsMuted] = useState(false);
  const [isVideoOff, setIsVideoOff] = useState(false);
  const [callDuration, setCallDuration] = useState(0);
  const [isCalling, setIsCalling] = useState(false);
  const [peerConnected, setPeerConnected] = useState(false);
  const [useJitsiFallback, setUseJitsiFallback] = useState(false);

  // WebRTC Refs
  const localVideoRef = useRef(null);
  const remoteVideoRef = useRef(null);
  const localStreamRef = useRef(null);
  const peerConnectionRef = useRef(null);
  const socketRef = useRef(null);
  const timerRef = useRef(null);

  // ICE Servers Configuration (Public Google STUN)
  const iceServers = {
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  };

  const evaluateTiming = useCallback((aptDate, startTime, endTime) => {
    try {
      const dateStr = new Date(aptDate).toISOString().split('T')[0];
      const startStr = startTime ? startTime.substring(0, 8) : '00:00:00';
      const endStr = endTime ? endTime.substring(0, 8) : '23:59:59';

      const slotStart = new Date(`${dateStr}T${startStr}`);
      const slotEnd = new Date(`${dateStr}T${endStr}`);
      const now = new Date();

      // Active from 10 minutes before slot until 2 hours after slot
      const unlockTime = new Date(slotStart.getTime() - 10 * 60 * 1000);
      const closeTime = new Date(slotEnd.getTime() + 2 * 60 * 60 * 1000);

      const canJoin = now >= unlockTime && now <= closeTime;
      const minutesUntilUnlock = Math.round((unlockTime.getTime() - now.getTime()) / (1000 * 60));

      setTimeState({
        canJoin,
        startsInMinutes: minutesUntilUnlock,
        unlocksAtText: unlockTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
        slotFormatted: `${new Date(aptDate).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} at ${startTime.substring(0, 5)}`
      });
    } catch (err) {
      console.warn('Timing evaluation error:', err);
      setTimeState({ canJoin: true, startsInMinutes: 0, unlocksAtText: '', slotFormatted: '' });
    }
  }, []);

  const fetchAppointmentDetails = useCallback(async () => {
    setLoading(true);
    try {
      const res = await api.get(`/chat/${appointmentId}`);
      const apt = res.data.appointment;
      setAppointment(apt);

      if (apt) {
        evaluateTiming(apt.appointment_date, apt.start_time, apt.end_time);

        // If current user is doctor, fetch patient health summary for clinical review
        if (user?.role === 'doctor') {
          try {
            const patRes = await api.get(`/patient/profile/${apt.patient_id || apt.id}`);
            setPatientProfile(patRes.data);
          } catch (e) {
            // optional profile
          }
        }
      }
    } catch (err) {
      console.error(err);
      toast.error('Failed to load video consultation details');
    } finally {
      setLoading(false);
    }
  }, [appointmentId, user?.role, evaluateTiming]);

  useEffect(() => {
    fetchAppointmentDetails();
  }, [fetchAppointmentDetails]);

  // Handle local camera & mic initialization
  const startLocalMedia = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      localStreamRef.current = stream;
      if (localVideoRef.current) {
        localVideoRef.current.srcObject = stream;
      }
      return stream;
    } catch (err) {
      console.warn('Could not access camera/mic, falling back to audio-only or Jitsi embed:', err.message);
      try {
        const audioStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        localStreamRef.current = audioStream;
        return audioStream;
      } catch (audioErr) {
        setUseJitsiFallback(true);
        return null;
      }
    }
  };

  // WebRTC Setup & Signaling
  const startCall = async () => {
    setIsCalling(true);
    const stream = await startLocalMedia();

    const socket = io('http://localhost:5000');
    socketRef.current = socket;

    const roomId = appointment?.meeting_room_id || `apt-${appointmentId}`;

    socket.emit('join_video_room', {
      roomId,
      userId: user?.id,
      userName: user?.name,
      userRole: user?.role
    });

    const pc = new RTCPeerConnection(iceServers);
    peerConnectionRef.current = pc;

    if (stream) {
      stream.getTracks().forEach((track) => pc.addTrack(track, stream));
    }

    pc.ontrack = (event) => {
      if (remoteVideoRef.current && event.streams[0]) {
        remoteVideoRef.current.srcObject = event.streams[0];
        setPeerConnected(true);
      }
    };

    pc.onicecandidate = (event) => {
      if (event.candidate) {
        socket.emit('ice_candidate', { roomId, candidate: event.candidate });
      }
    };

    // Socket Event Listeners for WebRTC signaling
    socket.on('user_joined_video', async () => {
      toast.info('Consultation participant joined the room!');
      try {
        const offer = await pc.createOffer();
        await pc.setLocalDescription(offer);
        socket.emit('video_offer', { roomId, offer });
      } catch (err) {
        console.error('Create offer error:', err);
      }
    });

    socket.on('video_offer', async ({ offer }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(offer));
        const answer = await pc.createAnswer();
        await pc.setLocalDescription(answer);
        socket.emit('video_answer', { roomId, answer });
        setPeerConnected(true);
      } catch (err) {
        console.error('Answer offer error:', err);
      }
    });

    socket.on('video_answer', async ({ answer }) => {
      try {
        await pc.setRemoteDescription(new RTCSessionDescription(answer));
        setPeerConnected(true);
      } catch (err) {
        console.error('Set remote answer error:', err);
      }
    });

    socket.on('ice_candidate', async ({ candidate }) => {
      try {
        await pc.addIceCandidate(new RTCIceCandidate(candidate));
      } catch (err) {
        console.error('Add ICE candidate error:', err);
      }
    });

    socket.on('user_left_video', () => {
      toast.warning('Participant has left the video room.');
      setPeerConnected(false);
      if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
    });

    // Start session duration timer
    timerRef.current = setInterval(() => {
      setCallDuration((prev) => prev + 1);
    }, 1000);
  };

  const endCall = () => {
    if (timerRef.current) clearInterval(timerRef.current);

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach((track) => track.stop());
    }

    if (peerConnectionRef.current) {
      peerConnectionRef.current.close();
    }

    if (socketRef.current) {
      const roomId = appointment?.meeting_room_id || `apt-${appointmentId}`;
      socketRef.current.emit('leave_video_room', { roomId });
      socketRef.current.disconnect();
    }

    setIsCalling(false);
    setPeerConnected(false);
    navigate('/dashboard');
  };

  const toggleMute = () => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
      }
    }
  };

  const toggleVideo = () => {
    if (localStreamRef.current) {
      const videoTrack = localStreamRef.current.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.enabled = !videoTrack.enabled;
        setIsVideoOff(!videoTrack.enabled);
      }
    }
  };

  const formatTimer = (seconds) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6">
        <svg className="animate-spin h-10 w-10 text-indigo-500 mb-4" fill="none" viewBox="0 0 24 24">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
        </svg>
        <p className="text-sm font-bold text-slate-400">Connecting to DocBook Telehealth Network...</p>
      </div>
    );
  }

  // 10-Minute Lock Screen
  if (!timeState.canJoin && appointment) {
    return (
      <div className="min-h-screen bg-slate-950 text-white flex items-center justify-center p-4">
        <div className="bg-slate-900 border border-indigo-900/40 rounded-3xl p-8 max-w-md w-full text-center shadow-2xl">
          <div className="w-16 h-16 rounded-2xl bg-indigo-500/20 text-indigo-300 text-3xl flex items-center justify-center mx-auto mb-5 border border-indigo-500/30">
            ⏳
          </div>
          <span className="text-xs font-black uppercase tracking-widest bg-indigo-500/20 text-indigo-300 px-3 py-1 rounded-full border border-indigo-500/30">
            Telehealth Room Waiting Lounge
          </span>
          <h2 className="text-2xl font-black mt-4">Consultation Room Locked</h2>
          <p className="text-xs text-indigo-200/70 mt-2 font-medium leading-relaxed">
            Per clinical protocol, this secure 1-on-1 video room unlocks <strong>10 minutes prior</strong> to your scheduled slot.
          </p>

          <div className="my-6 p-4 bg-slate-950 rounded-2xl border border-slate-800 text-left text-xs space-y-2">
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Scheduled Slot:</span>
              <span className="font-extrabold text-white">{timeState.slotFormatted}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-slate-400 font-bold">Room Opens At:</span>
              <span className="font-extrabold text-emerald-400">{timeState.unlocksAtText}</span>
            </div>
            {timeState.startsInMinutes > 0 && (
              <div className="flex justify-between border-t border-slate-800 pt-2 text-indigo-300 font-black">
                <span>Opens in:</span>
                <span>~{timeState.startsInMinutes} Minutes</span>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => evaluateTiming(appointment.appointment_date, appointment.start_time, appointment.end_time)}
              className="w-full py-3 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl text-xs font-bold shadow transition cursor-pointer"
            >
              🔄 Refresh Room Status
            </button>
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-3 bg-slate-800 hover:bg-slate-700 text-slate-300 rounded-xl text-xs font-bold transition cursor-pointer"
            >
              Return to Dashboard
            </button>
          </div>
        </div>
      </div>
    );
  }

  const roomSlug = appointment?.meeting_room_id || `docbook-room-${appointmentId}`;
  const otherPersonName = user?.role === 'patient'
    ? `Dr. ${appointment?.doctor_name}`
    : `${appointment?.patient_name}`;

  return (
    <div className="min-h-screen bg-slate-950 text-white flex flex-col font-sans">
      {/* Top Bar */}
      <header className="px-6 py-4 bg-slate-900 border-b border-slate-800 flex flex-wrap justify-between items-center gap-4">
        <div className="flex items-center space-x-3">
          <span className="w-3 h-3 rounded-full bg-emerald-400 animate-pulse"></span>
          <div>
            <h1 className="text-base font-black flex items-center gap-2">
              <span>📹 Telehealth Consultation Room</span>
              <span className="text-[10px] bg-indigo-500/20 text-indigo-300 px-2.5 py-0.5 rounded-full border border-indigo-500/30">
                #APT-{appointmentId}
              </span>
            </h1>
            <p className="text-xs text-slate-400 font-medium">
              Consulting with: <strong className="text-white">{otherPersonName}</strong>
            </p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          {isCalling && (
            <div className="bg-slate-950 border border-slate-800 px-3.5 py-1.5 rounded-xl font-mono text-xs text-emerald-400 font-black">
              ⏱️ {formatTimer(callDuration)}
            </div>
          )}

          <button
            onClick={() => setUseJitsiFallback(!useJitsiFallback)}
            className="text-xs font-bold text-indigo-300 hover:text-white bg-indigo-950/60 border border-indigo-800/40 px-3 py-1.5 rounded-lg transition"
          >
            {useJitsiFallback ? 'Switch to Native WebRTC' : 'Switch to Jitsi Telehealth Network'}
          </button>

          <button
            onClick={() => navigate('/dashboard')}
            className="text-xs font-bold text-slate-400 hover:text-white px-3 py-1.5 rounded-lg border border-slate-700 transition"
          >
            Exit to Dashboard
          </button>
        </div>
      </header>

      {/* Main Video Stage */}
      <main className="flex-1 p-4 lg:p-6 grid grid-cols-1 lg:grid-cols-4 gap-6 max-w-7xl mx-auto w-full">
        {/* Left/Center: Video Screens */}
        <div className="lg:col-span-3 flex flex-col justify-between bg-slate-900/90 rounded-3xl border border-slate-800 p-4 sm:p-6 shadow-2xl relative overflow-hidden">
          
          {useJitsiFallback ? (
            /* JITSI TELEHEALTH IFRAME ENGINE */
            <div className="flex-1 w-full h-[520px] rounded-2xl overflow-hidden border border-slate-800 shadow-inner">
              <iframe
                title="DocBook Jitsi Video Consultation"
                src={`https://meet.jit.si/${roomSlug}#userInfo.displayName="${encodeURIComponent(user?.name || 'Participant')}"&config.prejoinPageEnabled=false&config.disableDeepLinking=true`}
                allow="camera; microphone; fullscreen; display-capture; autoplay"
                className="w-full h-full border-0"
              />
            </div>
          ) : !isCalling ? (
            /* PRE-CALL LOBBY */
            <div className="flex-1 flex flex-col items-center justify-center text-center p-8">
              <div className="w-24 h-24 rounded-3xl bg-indigo-600/20 text-indigo-400 flex items-center justify-center text-5xl mb-5 border border-indigo-500/30 shadow-lg">
                👨‍⚕️
              </div>
              <h2 className="text-2xl font-black">Ready to Begin Video Consultation?</h2>
              <p className="text-xs text-slate-400 max-w-md mt-2 leading-relaxed">
                Your private telehealth room is ready. Ensure your camera and microphone permissions are enabled in your browser before starting.
              </p>

              <button
                onClick={startCall}
                className="mt-6 px-8 py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-extrabold rounded-2xl text-sm shadow-xl transition transform active:scale-95 cursor-pointer flex items-center gap-2"
              >
                <span>📹</span> Connect Video & Start Consultation
              </button>
            </div>
          ) : (
            /* ACTIVE WEBRTC VIDEO STAGE */
            <div className="flex-1 flex flex-col justify-between">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 flex-1 h-[480px]">
                {/* Local Peer Video */}
                <div className="relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
                  <video
                    ref={localVideoRef}
                    autoPlay
                    playsInline
                    muted
                    className="w-full h-full object-cover transform scale-x-[-1]"
                  />
                  <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-black border border-slate-700">
                    You ({user?.role})
                  </div>
                  {isVideoOff && (
                    <div className="absolute inset-0 bg-slate-950 flex items-center justify-center text-slate-500 text-xs font-bold">
                      Camera Off
                    </div>
                  )}
                </div>

                {/* Remote Peer Video */}
                <div className="relative bg-slate-950 rounded-2xl border border-slate-800 overflow-hidden flex items-center justify-center shadow-inner">
                  <video
                    ref={remoteVideoRef}
                    autoPlay
                    playsInline
                    className="w-full h-full object-cover"
                  />
                  {!peerConnected && (
                    <div className="absolute inset-0 flex flex-col items-center justify-center p-6 text-center bg-slate-950/80">
                      <svg className="animate-spin h-8 w-8 text-indigo-500 mb-3" fill="none" viewBox="0 0 24 24">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
                      </svg>
                      <p className="text-xs font-bold text-slate-300">
                        Waiting for {otherPersonName} to join room...
                      </p>
                      <p className="text-[10px] text-slate-500 mt-1">Their stream will connect automatically when they open this page.</p>
                    </div>
                  )}
                  <div className="absolute bottom-3 left-3 bg-slate-900/80 backdrop-blur-sm px-2.5 py-1 rounded-lg text-[11px] font-black border border-slate-700">
                    {otherPersonName}
                  </div>
                </div>
              </div>

              {/* Call Controls Bar */}
              <div className="flex items-center justify-center gap-3 pt-6">
                <button
                  onClick={toggleMute}
                  className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center text-lg transition shadow-md ${
                    isMuted ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={isMuted ? 'Unmute Mic' : 'Mute Mic'}
                >
                  {isMuted ? '🔇' : '🎙️'}
                </button>

                <button
                  onClick={toggleVideo}
                  className={`w-12 h-12 rounded-2xl font-bold flex items-center justify-center text-lg transition shadow-md ${
                    isVideoOff ? 'bg-rose-600 text-white' : 'bg-slate-800 text-slate-200 hover:bg-slate-700'
                  }`}
                  title={isVideoOff ? 'Turn Camera On' : 'Turn Camera Off'}
                >
                  {isVideoOff ? '🚫' : '📹'}
                </button>

                <button
                  onClick={endCall}
                  className="px-6 h-12 bg-rose-600 hover:bg-rose-700 text-white font-extrabold rounded-2xl text-xs flex items-center gap-2 shadow-lg transition active:scale-95"
                >
                  <span>📞</span> End Call
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Right Column: Clinical Consultation Drawer */}
        <div className="lg:col-span-1 bg-slate-900 rounded-3xl border border-slate-800 p-5 flex flex-col justify-between">
          <div className="space-y-4">
            <h3 className="text-xs font-black uppercase tracking-widest text-slate-400 pb-2 border-b border-slate-800">
              Clinical Session Details
            </h3>

            {/* Doctor Info */}
            <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-1">
              <span className="text-[10px] uppercase font-bold text-indigo-400">Practitioner</span>
              <p className="font-extrabold text-white text-sm">Dr. {appointment?.doctor_name}</p>
              <p className="text-slate-400 font-semibold">{appointment?.specialty}</p>
            </div>

            {/* Patient Info & Health Profile Alert (for Doctors) */}
            {user?.role === 'doctor' && patientProfile && (
              <div className="space-y-3">
                <div className="bg-slate-950 p-3.5 rounded-xl border border-slate-800 text-xs space-y-2">
                  <span className="text-[10px] uppercase font-bold text-emerald-400">Patient Vitals</span>
                  <div className="grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-400 block">Blood Group:</span>
                      <strong className="text-rose-400">{patientProfile.blood_group || 'N/A'}</strong>
                    </div>
                    <div>
                      <span className="text-slate-400 block">Gender:</span>
                      <strong>{patientProfile.gender || 'N/A'}</strong>
                    </div>
                  </div>

                  {patientProfile.allergies && (
                    <div className="p-2 bg-rose-950/60 border border-rose-800/60 rounded-lg text-[11px] text-rose-200">
                      <strong>⚠️ Allergy Alert:</strong> {patientProfile.allergies}
                    </div>
                  )}

                  {patientProfile.chronic_conditions && (
                    <div className="text-[11px] text-slate-300">
                      <span className="text-slate-400 block">Chronic Conditions:</span>
                      {patientProfile.chronic_conditions}
                    </div>
                  )}
                </div>
              </div>
            )}

            <div className="bg-indigo-950/30 p-3.5 rounded-xl border border-indigo-900/30 text-xs text-indigo-200/80 leading-relaxed font-medium">
              🔒 <strong>Encrypted Telehealth Session</strong>
              <p className="mt-1 text-[11px]">
                Audio and video streams are securely transmitted point-to-point. You can follow up in the consultation chat for 48 hours post-visit.
              </p>
            </div>
          </div>

          <div className="pt-4 border-t border-slate-800">
            <button
              onClick={() => navigate('/dashboard')}
              className="w-full py-2.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-xl text-xs font-bold transition text-center"
            >
              Back to Dashboard
            </button>
          </div>
        </div>
      </main>
    </div>
  );
};

export default VideoConsultation;
