import { Document, Page, StyleSheet } from "@react-pdf/renderer";
import Html from "react-pdf-html";

/**
 * The report as a PDF attachment: the template's HTML, mapped onto react-pdf primitives.
 *
 * react-pdf implements its own layout engine over a SUBSET of CSS — no grid, no floats, no positioning,
 * no media queries. Markup using those renders correctly in the HTML document and loses that styling
 * here, which is why `checkTemplate` warns about them in the editor rather than letting the difference
 * ship unnoticed. Everything the subset covers (flex rows, tables, borders, colours, sizing) survives.
 *
 * Fonts are the PDF built-ins (Helvetica) on purpose: registering a web font would mean a network fetch
 * per render inside the send path. A template naming another family falls back to Helvetica.
 */
export interface ReportPdfProps {
    /** Final body markup from `buildReportHtml`. */
    html: string;
    title: string;
    subject: string;
    locale: string;
}

const s = StyleSheet.create({
    page: {
        backgroundColor: "#fafafa",
        color: "#0a0a0a",
        fontFamily: "Helvetica",
        fontSize: 11,
        paddingVertical: 36,
        paddingHorizontal: 40,
    },
});

export function ReportPdf({ html, title, subject, locale }: ReportPdfProps) {
    return (
        <Document title={title} subject={subject} creator="Repolio" producer="Repolio" language={locale}>
            <Page size="A4" style={s.page} wrap>
                {/* resetStyles: react-pdf-html's own browser-like defaults fight the template's CSS
                    (notably huge default heading margins), so the template is the only styling. */}
                <Html resetStyles>{html}</Html>
            </Page>
        </Document>
    );
}
