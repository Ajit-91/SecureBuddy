import { BotContext } from "../../shared/types/telegram";

export async function helpHandler(ctx: BotContext): Promise<void> {
  const helpMessage = `🛡️ *SecureBuddy Help & Commands*

Here are the available commands:

/start \- Start the bot and get welcome info
/help \- Show this help message
/credits \- View your remaining daily analysis credits
/history \- View history of past analyses
/report <jobId> \- Fetch report details for a specific analysis

*How to analyze:*
• *Send a URL*: Simply type or paste any link (e.g. \`https://example.com\`)
• *Send a File*: Upload any PDF, ZIP, APK, DOCX, or TXT file

Each analysis costs *1 credit*. All analysis is run inside isolated Docker containers.`;

  await ctx.reply(helpMessage, { parse_mode: "MarkdownV2" });
}

export default helpHandler;
