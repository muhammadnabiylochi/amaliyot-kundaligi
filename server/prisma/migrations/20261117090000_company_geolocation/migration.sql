-- Korxona joylashuvi: Telegram orqali geolokatsiyali davomat uchun
ALTER TABLE "Company" ADD COLUMN "latitude" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN "longitude" DOUBLE PRECISION;
ALTER TABLE "Company" ADD COLUMN "checkinRadius" INTEGER NOT NULL DEFAULT 300;
