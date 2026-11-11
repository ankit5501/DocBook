import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

/**
 * Generates and downloads a clean, hospital-grade PDF prescription slip.
 * @param {HTMLElement} elementToPrint The DOM element of the prescription slip
 * @param {string} fileName The output filename
 */
export const downloadPrescriptionAsPDF = async (elementToPrint, fileName = 'DocBook_Prescription.pdf') => {
  if (!elementToPrint) {
    window.print();
    return;
  }

  try {
    const canvas = await html2canvas(elementToPrint, {
      scale: 2, // 2x resolution for crisp high-DPI text & lines
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    const imgData = canvas.toDataURL('image/png');
    const pdf = new jsPDF('p', 'mm', 'a4');
    const pdfWidth = pdf.internal.pageSize.getWidth();
    const pdfHeight = (canvas.height * pdfWidth) / canvas.width;

    pdf.addImage(imgData, 'PNG', 0, 0, pdfWidth, pdfHeight);
    pdf.save(fileName);
  } catch (err) {
    console.warn('html2canvas failed, falling back to window.print()', err);
    window.print();
  }
};
