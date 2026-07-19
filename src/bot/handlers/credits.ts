import { BotContext } from "../../shared/types/telegram";

export async function creditsHandler(ctx: BotContext): Promise<void> {
  const credits = ctx.dbUser?.credits ?? 0;
  const message = `💳 *Credits*

Remaining Credits: *${credits} / 10*

Resets at midnight daily.`;

  await ctx.reply(message, { parse_mode: "Markdown" });
}

export default creditsHandler;
