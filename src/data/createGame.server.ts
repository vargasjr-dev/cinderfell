import { Sandbox } from '@vercel/sandbox';
import { db } from "../../data/db";
import { gameSession } from "../../data/schema";

const PROJECT_ID = 'prj_bAckE5PGlllJHSE2kGL74Bq3MjPV';

/**
 * Creates a new game session using Vercel Sandbox
 * Tracks the session in Postgres
 */
const createGame = async (userId: string) => {
  try {
    // Create a Vercel Sandbox deployment for the game server
    const sbx = await Sandbox.create({
      token: process.env.VERCEL_TOKEN!,
      source: {
        type: 'git',
        url: 'https://github.com/vargasjr-dev/cinderling.game.git',
        revision: 'main',
      },
      ports: [12345], // WebSocket game server port
      timeout: 3600000, // 1 hour
    });
    
    // Get the URL for the exposed port
    const gameServerUrl = sbx.routes.find(r => r.port === 12345)?.url || sbx.routes[0]?.url;
    
    // Track game session in Postgres
    const [session] = await db.insert(gameSession).values({
      deploymentId: sbx.sandboxId,
      status: 'active',
      createdBy: userId,
      maxPlayers: 4,
      currentPlayers: 1,
      metadata: {
        deploymentUrl: gameServerUrl,
      },
    }).returning();

    return {
      sessionId: session.uuid,
      deploymentId: sbx.sandboxId,
      url: gameServerUrl,
    };
  } catch (error) {
    console.error('Failed to create game:', error);
    throw new Error('Failed to create game session');
  }
};

export default createGame;
