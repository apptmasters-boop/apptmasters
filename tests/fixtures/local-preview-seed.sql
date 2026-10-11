-- Sample listings for a local preview database (apptmasters_live on port 5433). Not for tests or production.
INSERT INTO "User"(id,name,email,password,"updatedAt") VALUES ('u1','Test Owner','owner@example.com','x',now());
INSERT INTO "Listing"(id,type,status,title,description,price,"priceMax",city,state,bedrooms,bathrooms,"availableFrom","leaseLength","roommateLifestyleTags","roommateSmoking","roommatePets","ownerId","updatedAt","createdAt") VALUES
('l1','ROOM_TO_SHARE','APPROVED','Sunny private room near the park','desc',850,NULL,'Queens','NY',3,2,'2026-11-01','3 months','["quiet-household","non-smoker"]','NO','NO','u1',now(),now()),
('l2','ROOM_TO_SHARE','APPROVED','Shared room in friendly community home','desc',720,NULL,'Brooklyn','NY',4,2,'2026-11-15','month-to-month','["student-friendly","pet-friendly"]','EITHER','YES','u1',now(),now() - interval '5 days'),
('l3','APARTMENT_FOR_RENT','APPROVED','Bright 1-bedroom in Manhattan with a very long title that should truncate','desc',2950,NULL,'Manhattan','NY',1,1,'2026-12-01','1 year','[]',NULL,NULL,'u1',now(),now() - interval '6 days'),
('l4','ROOM_TO_SHARE','APPROVED','Room in Astoria apartment','desc',780,980,'Astoria','NY',3,2,NULL,NULL,'["night-owl"]','NO','EITHER','u1',now(),now() - interval '8 days'),
('l5','ROOM_TO_SHARE','PENDING','Pending listing should not show','desc',500,NULL,'Bronx','NY',2,1,NULL,NULL,'[]',NULL,NULL,'u1',now(),now());
INSERT INTO "ListingPhoto"(id,url,position,"listingId") VALUES ('p1','/landing/hero.png',0,'l1'),('p2','/landing/hero.png',0,'l2'),('p4','/landing/hero.png',0,'l4');
