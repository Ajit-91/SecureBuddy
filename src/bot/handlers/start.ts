import { BotContext } from "../../shared/types/telegram";

export async function startHandler(ctx: BotContext): Promise<void> {
  const welcomeMessage = `👋 *Welcome to SecureBuddy*

I can analyze potentially malicious content inside isolated environments:

🔗 *URLs*
📄 *PDFs*
📦 *ZIP files*
📱 *APK files*
📑 *Documents (DOCX, TXT)*

Simply send a URL or upload a file to begin.

*Examples:*
\`https://example.com\`

*Or upload:*
• APK file
• PDF file
• ZIP file
• DOCX / TXT document`;

  await ctx.reply(welcomeMessage, { parse_mode: "Markdown" });
}

export default startHandler;
