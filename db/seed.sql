USE pharmaflow;
INSERT IGNORE INTO categories(name) VALUES ('Pain Relief'),('Antibiotics'),('Vitamins'),('Diabetes'),('Cardiac Care'),('Skin Care');
INSERT IGNORE INTO medicines(category_id,name,generic_name,manufacturer,description,price,stock,prescription_required,image_url) VALUES
(1,'Paracetamol 500mg','Paracetamol','PharmaCare','For temporary relief of fever and mild pain.',35,120,FALSE,'https://images.unsplash.com/photo-1584308666744-24d5c474f2ae?w=600'),
(2,'Azithromycin 500mg','Azithromycin','MedLabs','Prescription antibiotic. Pharmacist approval required.',120,60,TRUE,'https://images.unsplash.com/photo-1471864190281-a93a3070b6de?w=600'),
(3,'Vitamin D3 60K','Cholecalciferol','NutriHealth','Weekly vitamin D supplement.',85,90,FALSE,'https://images.unsplash.com/photo-1607619056574-7b8d3ee536b2?w=600'),
(4,'Metformin 500mg','Metformin','GlucoCare','Prescription medicine for type 2 diabetes.',75,80,TRUE,'https://images.unsplash.com/photo-1550572017-edd951aa8ca1?w=600'),
(5,'Atorvastatin 10mg','Atorvastatin','CardioPlus','Prescription cholesterol medicine.',110,50,TRUE,'https://images.unsplash.com/photo-1585435557343-3b092031a831?w=600'),
(6,'Adapalene Gel','Adapalene','DermaLabs','Topical acne treatment.',180,40,TRUE,'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=600');
INSERT IGNORE INTO users(name,email,password_hash,role) VALUES
('Demo Customer','customer@pharmaflow.local','$2b$10$uK5QwZfYp7rYwK9J2lKz3O7n8w7j2dM3kYy1b0n9V8o0g4n6c5s2a','CUSTOMER'),
('Dr. Pharmacist','pharmacist@pharmaflow.local','$2b$10$uK5QwZfYp7rYwK9J2lKz3O7n8w7j2dM3kYy1b0n9V8o0g4n6c5s2a','PHARMACIST'),
('System Admin','admin@pharmaflow.local','$2b$10$uK5QwZfYp7rYwK9J2lKz3O7n8w7j2dM3kYy1b0n9V8o0g4n6c5s2a','ADMIN');
