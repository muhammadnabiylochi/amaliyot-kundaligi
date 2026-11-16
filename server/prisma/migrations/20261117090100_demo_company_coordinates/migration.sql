-- Demo korxonalar uchun taxminiy koordinatalar (faqat hali kiritilmagan bo'lsa)
UPDATE "Company" SET "latitude" = 41.2946, "longitude" = 69.2777 WHERE "name" = 'Uzcard MChJ' AND "latitude" IS NULL;
UPDATE "Company" SET "latitude" = 41.3205, "longitude" = 69.2470 WHERE "name" = 'EPAM Systems' AND "latitude" IS NULL;
UPDATE "Company" SET "latitude" = 41.2195, "longitude" = 69.2275 WHERE "name" = 'Artel Electronics' AND "latitude" IS NULL;
UPDATE "Company" SET "latitude" = 41.3237, "longitude" = 69.2829 WHERE "name" = 'O''zbektelekom AK' AND "latitude" IS NULL;
