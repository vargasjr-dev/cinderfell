CREATE TABLE "account" (
	"id" text PRIMARY KEY NOT NULL,
	"accountId" text NOT NULL,
	"providerId" text NOT NULL,
	"userId" text NOT NULL,
	"accessToken" text,
	"refreshToken" text,
	"idToken" text,
	"expiresAt" timestamp,
	"password" text,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL
);
--> statement-breakpoint
CREATE TABLE "aiProfile" (
	"id" text PRIMARY KEY NOT NULL,
	"name" varchar(64) NOT NULL,
	"teamNames" json NOT NULL,
	"aiDifficulty" varchar(16) DEFAULT 'medium' NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmetic" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"cinderlingId" uuid,
	"type" text NOT NULL,
	"name" text NOT NULL,
	"imageUrl" text,
	"metadata" json,
	"source" text NOT NULL,
	"seasonId" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cosmeticLoadout" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"cinderlingId" uuid NOT NULL,
	"equippedSkinId" uuid,
	"equippedVfxIds" json DEFAULT '[]'::json,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "currencyTransaction" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"amount" integer NOT NULL,
	"type" text NOT NULL,
	"description" text,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gamePlayer" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameSessionUuid" uuid NOT NULL,
	"userId" text NOT NULL,
	"teamUuid" uuid NOT NULL,
	"joinedAt" timestamp DEFAULT now() NOT NULL,
	"status" varchar(32) DEFAULT 'active' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "gameSession" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"deploymentId" varchar(256),
	"status" varchar(32) DEFAULT 'waiting' NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	"createdBy" text NOT NULL,
	"maxPlayers" integer DEFAULT 2 NOT NULL,
	"currentPlayers" integer DEFAULT 1 NOT NULL,
	"metadata" json
);
--> statement-breakpoint
CREATE TABLE "matchSnapshot" (
	"id" text PRIMARY KEY NOT NULL,
	"gameState" json NOT NULL,
	"turnSnapshots" json,
	"turnLogs" json,
	"status" varchar(32) DEFAULT 'completed' NOT NULL,
	"p1ProfileId" text,
	"p2ProfileId" text,
	"uploadedAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "matchStats" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"gameSessionUuid" uuid NOT NULL,
	"userId" text NOT NULL,
	"result" varchar(16) NOT NULL,
	"turns" integer DEFAULT 0 NOT NULL,
	"enemyKOs" integer DEFAULT 0 NOT NULL,
	"ownKOs" integer DEFAULT 0 NOT NULL,
	"winCondition" varchar(32),
	"isSparring" boolean DEFAULT false NOT NULL,
	"aiDifficulty" varchar(16),
	"completedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "season" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" text NOT NULL,
	"startDate" timestamp NOT NULL,
	"endDate" timestamp NOT NULL,
	"status" text DEFAULT 'upcoming' NOT NULL,
	"newCinderlingId" integer,
	"createdAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "seasonTrack" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"seasonId" uuid NOT NULL,
	"tier" integer NOT NULL,
	"freeReward" json,
	"premiumReward" json
);
--> statement-breakpoint
CREATE TABLE "session" (
	"id" text PRIMARY KEY NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"token" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp NOT NULL,
	"ipAddress" text,
	"userAgent" text,
	"userId" text NOT NULL,
	CONSTRAINT "session_token_unique" UNIQUE("token")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"name" varchar(64) NOT NULL,
	"userId" text NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "teamSlot" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"teamUuid" uuid NOT NULL,
	"cinderlingInstanceUuid" uuid NOT NULL,
	"slotIndex" integer NOT NULL,
	"isActive" boolean DEFAULT false NOT NULL
);
--> statement-breakpoint
CREATE TABLE "user" (
	"id" text PRIMARY KEY NOT NULL,
	"name" text NOT NULL,
	"email" text NOT NULL,
	"emailVerified" boolean DEFAULT false NOT NULL,
	"image" text,
	"username" text,
	"role" text DEFAULT 'user' NOT NULL,
	"stripeCustomerId" text,
	"subscriptionId" text,
	"subscriptionStatus" text DEFAULT 'none' NOT NULL,
	"subscribedAt" timestamp,
	"subscriptionStreakMonths" integer DEFAULT 0 NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL,
	CONSTRAINT "user_email_unique" UNIQUE("email"),
	CONSTRAINT "user_stripeCustomerId_unique" UNIQUE("stripeCustomerId")
);
--> statement-breakpoint
CREATE TABLE "userAchievement" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"achievementId" text NOT NULL,
	"unlockedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userCurrency" (
	"userId" text PRIMARY KEY NOT NULL,
	"balance" integer DEFAULT 0 NOT NULL,
	"lifetimeEarned" integer DEFAULT 0 NOT NULL,
	"lifetimeSpent" integer DEFAULT 0 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userLoginStreak" (
	"userId" text PRIMARY KEY NOT NULL,
	"currentStreak" integer DEFAULT 0 NOT NULL,
	"longestStreak" integer DEFAULT 0 NOT NULL,
	"lastClaimedDate" text DEFAULT '' NOT NULL,
	"totalClaimed" integer DEFAULT 0 NOT NULL,
	"streakFreezeCount" integer DEFAULT 0 NOT NULL,
	"lastFreezeGrantDate" text DEFAULT '' NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userQuestProgress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"questId" text NOT NULL,
	"date" text NOT NULL,
	"progress" integer DEFAULT 0 NOT NULL,
	"completed" boolean DEFAULT false NOT NULL,
	"rewardClaimed" boolean DEFAULT false NOT NULL,
	"completedAt" timestamp
);
--> statement-breakpoint
CREATE TABLE "userRank" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"seasonId" uuid NOT NULL,
	"rank" text DEFAULT 'bronze' NOT NULL,
	"stars" integer DEFAULT 0 NOT NULL,
	"peakRank" text DEFAULT 'bronze' NOT NULL,
	"peakStars" integer DEFAULT 0 NOT NULL,
	"legendEntry" integer,
	"gamesPlayed" integer DEFAULT 0 NOT NULL,
	"wins" integer DEFAULT 0 NOT NULL,
	"losses" integer DEFAULT 0 NOT NULL,
	"mmr" integer DEFAULT 1000 NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "userSeasonProgress" (
	"id" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"userId" text NOT NULL,
	"seasonId" uuid NOT NULL,
	"xp" integer DEFAULT 0 NOT NULL,
	"currentTier" integer DEFAULT 0 NOT NULL,
	"claimedFreeTiers" json DEFAULT '[]'::json,
	"claimedPremiumTiers" json DEFAULT '[]'::json,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
CREATE TABLE "cinderlingInstance" (
	"uuid" uuid PRIMARY KEY DEFAULT gen_random_uuid() NOT NULL,
	"address" varchar(64) NOT NULL,
	"network" integer NOT NULL,
	"version" varchar(17) NOT NULL,
	"userId" varchar(32) NOT NULL,
	"modelUuid" uuid NOT NULL,
	CONSTRAINT "cinderlingInstance_address_unique" UNIQUE("address"),
	CONSTRAINT "cinderlingInstance_network_unique" UNIQUE("network")
);
--> statement-breakpoint
CREATE TABLE "verification" (
	"id" text PRIMARY KEY NOT NULL,
	"identifier" text NOT NULL,
	"value" text NOT NULL,
	"expiresAt" timestamp NOT NULL,
	"createdAt" timestamp DEFAULT now() NOT NULL,
	"updatedAt" timestamp DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "account" ADD CONSTRAINT "account_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmetic" ADD CONSTRAINT "cosmetic_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmeticLoadout" ADD CONSTRAINT "cosmeticLoadout_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cosmeticLoadout" ADD CONSTRAINT "cosmeticLoadout_equippedSkinId_cosmetic_id_fk" FOREIGN KEY ("equippedSkinId") REFERENCES "public"."cosmetic"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "currencyTransaction" ADD CONSTRAINT "currencyTransaction_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamePlayer" ADD CONSTRAINT "gamePlayer_gameSessionUuid_gameSession_uuid_fk" FOREIGN KEY ("gameSessionUuid") REFERENCES "public"."gameSession"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamePlayer" ADD CONSTRAINT "gamePlayer_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gamePlayer" ADD CONSTRAINT "gamePlayer_teamUuid_team_uuid_fk" FOREIGN KEY ("teamUuid") REFERENCES "public"."team"("uuid") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "gameSession" ADD CONSTRAINT "gameSession_createdBy_user_id_fk" FOREIGN KEY ("createdBy") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchSnapshot" ADD CONSTRAINT "matchSnapshot_p1ProfileId_aiProfile_id_fk" FOREIGN KEY ("p1ProfileId") REFERENCES "public"."aiProfile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchSnapshot" ADD CONSTRAINT "matchSnapshot_p2ProfileId_aiProfile_id_fk" FOREIGN KEY ("p2ProfileId") REFERENCES "public"."aiProfile"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchStats" ADD CONSTRAINT "matchStats_gameSessionUuid_gameSession_uuid_fk" FOREIGN KEY ("gameSessionUuid") REFERENCES "public"."gameSession"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "matchStats" ADD CONSTRAINT "matchStats_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "seasonTrack" ADD CONSTRAINT "seasonTrack_seasonId_season_id_fk" FOREIGN KEY ("seasonId") REFERENCES "public"."season"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "session" ADD CONSTRAINT "session_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamSlot" ADD CONSTRAINT "teamSlot_teamUuid_team_uuid_fk" FOREIGN KEY ("teamUuid") REFERENCES "public"."team"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "teamSlot" ADD CONSTRAINT "teamSlot_cinderlingInstanceUuid_cinderlingInstance_uuid_fk" FOREIGN KEY ("cinderlingInstanceUuid") REFERENCES "public"."cinderlingInstance"("uuid") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userAchievement" ADD CONSTRAINT "userAchievement_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userCurrency" ADD CONSTRAINT "userCurrency_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userLoginStreak" ADD CONSTRAINT "userLoginStreak_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userQuestProgress" ADD CONSTRAINT "userQuestProgress_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRank" ADD CONSTRAINT "userRank_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userRank" ADD CONSTRAINT "userRank_seasonId_season_id_fk" FOREIGN KEY ("seasonId") REFERENCES "public"."season"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userSeasonProgress" ADD CONSTRAINT "userSeasonProgress_userId_user_id_fk" FOREIGN KEY ("userId") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "userSeasonProgress" ADD CONSTRAINT "userSeasonProgress_seasonId_season_id_fk" FOREIGN KEY ("seasonId") REFERENCES "public"."season"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "account_userId_idx" ON "account" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cosmetic_userId_idx" ON "cosmetic" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cosmetic_cinderlingId_idx" ON "cosmetic" USING btree ("cinderlingId");--> statement-breakpoint
CREATE INDEX "cosmetic_type_idx" ON "cosmetic" USING btree ("type");--> statement-breakpoint
CREATE INDEX "cosmeticLoadout_userId_idx" ON "cosmeticLoadout" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "cosmeticLoadout_cinderlingId_idx" ON "cosmeticLoadout" USING btree ("cinderlingId");--> statement-breakpoint
CREATE INDEX "currencyTransaction_userId_idx" ON "currencyTransaction" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "currencyTransaction_createdAt_idx" ON "currencyTransaction" USING btree ("createdAt");--> statement-breakpoint
CREATE INDEX "gamePlayer_gameSessionUuid_idx" ON "gamePlayer" USING btree ("gameSessionUuid");--> statement-breakpoint
CREATE INDEX "gamePlayer_userId_idx" ON "gamePlayer" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "gameSession_createdBy_idx" ON "gameSession" USING btree ("createdBy");--> statement-breakpoint
CREATE INDEX "matchStats_userId_idx" ON "matchStats" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "matchStats_gameSessionUuid_idx" ON "matchStats" USING btree ("gameSessionUuid");--> statement-breakpoint
CREATE INDEX "seasonTrack_seasonId_idx" ON "seasonTrack" USING btree ("seasonId");--> statement-breakpoint
CREATE INDEX "session_userId_idx" ON "session" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "team_userId_idx" ON "team" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "teamSlot_teamUuid_idx" ON "teamSlot" USING btree ("teamUuid");--> statement-breakpoint
CREATE INDEX "teamSlot_cinderlingInstanceUuid_idx" ON "teamSlot" USING btree ("cinderlingInstanceUuid");--> statement-breakpoint
CREATE INDEX "userAchievement_userId_idx" ON "userAchievement" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "userAchievement_userId_achievementId_idx" ON "userAchievement" USING btree ("userId","achievementId");--> statement-breakpoint
CREATE INDEX "userQuestProgress_userId_date_idx" ON "userQuestProgress" USING btree ("userId","date");--> statement-breakpoint
CREATE INDEX "userQuestProgress_userId_questId_date_idx" ON "userQuestProgress" USING btree ("userId","questId","date");--> statement-breakpoint
CREATE INDEX "userRank_userId_idx" ON "userRank" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "userRank_seasonId_idx" ON "userRank" USING btree ("seasonId");--> statement-breakpoint
CREATE INDEX "userRank_rank_idx" ON "userRank" USING btree ("rank");--> statement-breakpoint
CREATE INDEX "userRank_mmr_idx" ON "userRank" USING btree ("mmr");--> statement-breakpoint
CREATE INDEX "userSeasonProgress_userId_idx" ON "userSeasonProgress" USING btree ("userId");--> statement-breakpoint
CREATE INDEX "userSeasonProgress_seasonId_idx" ON "userSeasonProgress" USING btree ("seasonId");--> statement-breakpoint
CREATE INDEX "verification_identifier_idx" ON "verification" USING btree ("identifier");