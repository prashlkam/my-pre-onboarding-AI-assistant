import { Message } from '../components/Chat';

export async function generateWordDocument(userData: any, messages: Message[]) {
  const { Document, Packer, Paragraph, TextRun, HeadingLevel } = await import('docx');

  const doc = new Document({
    sections: [
      {
        properties: {},
        children: [
          new Paragraph({
            text: "Candidate Pre-Onboarding Report",
            heading: HeadingLevel.HEADING_1,
            spacing: { after: 400 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Name: ", bold: true }),
              new TextRun(userData.name || "N/A"),
            ],
            spacing: { after: 120 },
          }),
          new Paragraph({
            children: [
              new TextRun({ text: "Role: ", bold: true }),
              new TextRun(userData.role || "N/A"),
            ],
            spacing: { after: 400 },
          }),
          new Paragraph({
            text: "Instruction Exceptions / Objections",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          ...(userData.instructionExceptions.length > 0
            ? userData.instructionExceptions.map((ex: any) => new Paragraph({
                text: `- ${ex.instruction}: ${ex.reason}`,
                spacing: { after: 120 },
              }))
            : [new Paragraph({ text: "None", spacing: { after: 120 } })]),
          new Paragraph({
            text: "Completed Tasks",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          ...(userData.completedTasks.length > 0
            ? userData.completedTasks.map((task: any) => new Paragraph({
                text: `- ${task.item}`,
                spacing: { after: 120 },
              }))
            : [new Paragraph({ text: "None", spacing: { after: 120 } })]),
          new Paragraph({
            text: "Pending Tasks",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 200, after: 200 },
          }),
          ...(userData.pendingTasks.length > 0
            ? userData.pendingTasks.map((task: any) => new Paragraph({
                text: `- ${task.item}`,
                spacing: { after: 120 },
              }))
            : [new Paragraph({ text: "None", spacing: { after: 120 } })]),
          new Paragraph({
            text: "Full Chat Transcript",
            heading: HeadingLevel.HEADING_2,
            spacing: { before: 400, after: 200 },
          }),
          ...messages.map(msg => new Paragraph({
            children: [
              new TextRun({ text: `${msg.role === 'ai' ? 'AI' : 'Candidate'}: `, bold: true }),
              new TextRun(msg.text),
            ],
            spacing: { after: 120 },
          }))
        ],
      },
    ],
  });

  return await Packer.toBlob(doc);
}
