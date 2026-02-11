import type { BotEngine } from "./bot-engine";

export interface Scenario {
    id: string;
    name: string;
    description: string;
    execute: (engine: BotEngine, targetGroupId?: string) => Promise<() => void>;
}

export const SCENARIOS: Scenario[] = [
    {
        id: "casual-chat",
        name: "Casual Chat",
        description: "Two bots having a slow conversation",
        execute: async (engine, groupId) => {
            const alice = await engine.spawnBot("Alice", "https://api.dicebear.com/7.x/avataaars/svg?seed=Alice");
            const bob = await engine.spawnBot("Bob", "https://api.dicebear.com/7.x/avataaars/svg?seed=Bob");

            const messages = [
                "Hey Bob, did you see the new update?",
                "Yeah! Ghost Protocol looks amazing.",
                "I love how fast it feels in mock mode.",
                "Exactly, dev efficiency +1000!"
            ];

            let index = 0;
            const interval = setInterval(async () => {
                const bot = index % 2 === 0 ? alice : bob;
                await engine.sendMessage(bot.id, messages[index % messages.length], groupId);
                index++;
            }, 5000);

            return () => clearInterval(interval);
        }
    },
    {
        id: "heavy-traffic",
        name: "Heavy Traffic",
        description: "Rapid fire messages from multiple bots",
        execute: async (engine, groupId) => {
            const bots = await Promise.all([
                engine.spawnBot("Bot 1"),
                engine.spawnBot("Bot 2"),
                engine.spawnBot("Bot 3"),
                engine.spawnBot("Bot 4"),
                engine.spawnBot("Bot 5")
            ]);

            const interval = setInterval(async () => {
                const bot = bots[Math.floor(Math.random() * bots.length)];
                await engine.sendMessage(bot.id, "Spamming for science! Row " + Math.random().toString(36).substring(7), groupId);
            }, 500);

            return () => clearInterval(interval);
        }
    }
];
