"""PDF generation service for reports and exports."""
from typing import Dict, List, Optional, Any
from dataclasses import dataclass, field
from datetime import datetime
from io import BytesIO
import logging

logger = logging.getLogger(__name__)


@dataclass
class PDFDocument:
    """Represents a generated PDF document."""
    id: str
    title: str
    content: bytes
    filename: str
    created_at: datetime = field(default_factory=datetime.utcnow)
    metadata: Dict[str, Any] = field(default_factory=dict)
    page_count: int = 0
    file_size: int = 0


class PDFService:
    """Service for generating PDF documents."""
    
    def __init__(self):
        self._check_dependencies()
    
    def _check_dependencies(self):
        """Check if required dependencies are available."""
        try:
            from reportlab.lib.pagesizes import letter
            from reportlab.pdfgen import canvas
            self._reportlab_available = True
        except ImportError:
            self._reportlab_available = False
            logger.warning("reportlab not installed - PDF generation limited")
    
    def generate_report(
        self,
        title: str,
        sections: List[Dict[str, Any]],
        metadata: Optional[Dict] = None,
    ) -> PDFDocument:
        """Generate a report PDF."""
        import uuid
        
        if not self._reportlab_available:
            return self._generate_simple_pdf(title, str(sections))
        
        from reportlab.lib.pagesizes import letter
        from reportlab.lib import colors
        from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
        from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, Table, TableStyle
        from reportlab.lib.units import inch
        
        buffer = BytesIO()
        doc = SimpleDocTemplate(buffer, pagesize=letter)
        styles = getSampleStyleSheet()
        
        elements = []
        
        title_style = ParagraphStyle(
            'CustomTitle',
            parent=styles['Heading1'],
            fontSize=24,
            spaceAfter=30,
        )
        elements.append(Paragraph(title, title_style))
        elements.append(Spacer(1, 0.25 * inch))
        
        for section in sections:
            section_title = section.get("title", "")
            if section_title:
                elements.append(Paragraph(section_title, styles['Heading2']))
                elements.append(Spacer(1, 0.1 * inch))
            
            content = section.get("content", "")
            if content:
                elements.append(Paragraph(content, styles['Normal']))
                elements.append(Spacer(1, 0.2 * inch))
            
            table_data = section.get("table")
            if table_data:
                t = Table(table_data)
                t.setStyle(TableStyle([
                    ('BACKGROUND', (0, 0), (-1, 0), colors.grey),
                    ('TEXTCOLOR', (0, 0), (-1, 0), colors.whitesmoke),
                    ('ALIGN', (0, 0), (-1, -1), 'CENTER'),
                    ('FONTNAME', (0, 0), (-1, 0), 'Helvetica-Bold'),
                    ('FONTSIZE', (0, 0), (-1, 0), 12),
                    ('BOTTOMPADDING', (0, 0), (-1, 0), 12),
                    ('BACKGROUND', (0, 1), (-1, -1), colors.beige),
                    ('TEXTCOLOR', (0, 1), (-1, -1), colors.black),
                    ('FONTNAME', (0, 1), (-1, -1), 'Helvetica'),
                    ('FONTSIZE', (0, 1), (-1, -1), 10),
                    ('GRID', (0, 0), (-1, -1), 1, colors.black),
                ]))
                elements.append(t)
                elements.append(Spacer(1, 0.3 * inch))
        
        doc.build(elements)
        
        content = buffer.getvalue()
        buffer.close()
        
        doc_id = str(uuid.uuid4())
        filename = f"{title.replace(' ', '_').lower()}_{datetime.now().strftime('%Y%m%d')}.pdf"
        
        return PDFDocument(
            id=doc_id,
            title=title,
            content=content,
            filename=filename,
            metadata=metadata or {},
            file_size=len(content),
        )
    
    def generate_invoice(
        self,
        invoice_number: str,
        tenant_name: str,
        items: List[Dict],
        total: float,
        period: str,
        due_date: str,
        metadata: Optional[Dict] = None,
    ) -> PDFDocument:
        """Generate an invoice PDF."""
        sections = [
            {
                "title": "Bill To",
                "content": tenant_name,
            },
            {
                "title": "Invoice Details",
                "content": f"Invoice #: {invoice_number}<br/>Period: {period}<br/>Due Date: {due_date}",
            },
            {
                "title": "Line Items",
                "table": [
                    ["Description", "Quantity", "Unit Price", "Amount"],
                    *[[i["description"], str(i.get("quantity", 1)), f"${i.get('unit_price', 0):.2f}", f"${i.get('amount', 0):.2f}"] for i in items],
                    ["", "", "Total:", f"${total:.2f}"],
                ],
            },
        ]
        
        return self.generate_report(
            title=f"Invoice #{invoice_number}",
            sections=sections,
            metadata={
                "type": "invoice",
                "invoice_number": invoice_number,
                "tenant_name": tenant_name,
                "total": total,
                **(metadata or {}),
            },
        )
    
    def generate_energy_report(
        self,
        site_name: str,
        period: str,
        consumption_data: List[Dict],
        cost_data: List[Dict],
        summary: Dict,
        metadata: Optional[Dict] = None,
    ) -> PDFDocument:
        """Generate an energy consumption report PDF."""
        sections = [
            {
                "title": "Report Summary",
                "content": f"Site: {site_name}<br/>Period: {period}",
            },
            {
                "title": "Key Metrics",
                "table": [
                    ["Metric", "Value"],
                    ["Total Consumption", f"{summary.get('total_kwh', 0):,.2f} kWh"],
                    ["Average Daily", f"{summary.get('avg_daily_kwh', 0):,.2f} kWh"],
                    ["Peak Demand", f"{summary.get('peak_kw', 0):,.2f} kW"],
                    ["Total Cost", f"${summary.get('total_cost', 0):,.2f}"],
                ],
            },
            {
                "title": "Consumption by Source",
                "table": [
                    ["Source", "kWh", "Percentage"],
                    *[[d["source"], f"{d['kwh']:,.2f}", f"{d['percentage']:.1f}%"] for d in consumption_data],
                ],
            },
        ]
        
        return self.generate_report(
            title=f"Energy Report - {site_name}",
            sections=sections,
            metadata={
                "type": "energy_report",
                "site_name": site_name,
                "period": period,
                **(metadata or {}),
            },
        )
    
    def _generate_simple_pdf(self, title: str, content: str) -> PDFDocument:
        """Generate a simple text PDF when reportlab is not available."""
        import uuid
        
        pdf_content = f"%PDF-1.4\n{title}\n{content}\n%%EOF".encode()
        
        return PDFDocument(
            id=str(uuid.uuid4()),
            title=title,
            content=pdf_content,
            filename=f"{title.lower().replace(' ', '_')}.pdf",
            file_size=len(pdf_content),
        )


pdf_service = PDFService()
