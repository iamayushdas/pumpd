/* Migration script: Move exercise JSON metadata, images, and GIFs to MongoDB Atlas */
import { MongoClient, Binary } from 'mongodb';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const projectRoot = path.join(__dirname, '..');

// Read .env
let MONGO_URI = 'mongodb://localhost:27017';
let MONGO_DB = 'pumpd';

const envPath = path.join(projectRoot, '.env');
if (fs.existsSync(envPath)) {
  const envContent = fs.readFileSync(envPath, 'utf8');
  for (const line of envContent.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const [k, ...v] = trimmed.split('=');
    const val = v.join('=');
    if (k === 'MONGO_URI') MONGO_URI = val;
    if (k === 'MONGO_DB') MONGO_DB = val;
  }
}

const MEDIA_DIR = path.join(projectRoot, 'media');

async function main() {
  console.log(`Connecting to MongoDB: ${MONGO_URI.replace(/:([^:@]+)@/, ':****@')}/${MONGO_DB}`);
  const client = new MongoClient(MONGO_URI);
  await client.connect();
  console.log('✓ Connected to MongoDB');

  const db = client.db(MONGO_DB);
  const exercisesCollection = db.collection('exercises');
  const mediaCollection = db.collection('exercise_media');

  // 1. Migrate exercise JSON data
  console.log('\n📋 Importing exercise JSON metadata...');
  const exercisesDataModule = await import('../frontend/src/lib/exercises-data.js');
  const exdb = exercisesDataModule.EXDB || [];
  console.log(`Found ${exdb.length} exercises in dataset.`);

  if (exdb.length > 0) {
    const ops = exdb.map(ex => ({
      updateOne: {
        filter: { _id: ex.id },
        update: { $set: { ...ex, _id: ex.id, updatedAt: new Date() } },
        upsert: true
      }
    }));
    const res = await exercisesCollection.bulkWrite(ops);
    console.log(`✓ Stored ${exdb.length} exercise JSON documents (upserted: ${res.upsertedCount}, modified: ${res.modifiedCount}, matched: ${res.matchedCount})`);
  }

  // 2. Migrate images
  const imgDir = path.join(MEDIA_DIR, 'img');
  if (fs.existsSync(imgDir)) {
    const imgFiles = fs.readdirSync(imgDir).filter(f => f.endsWith('.jpg') || f.endsWith('.jpeg') || f.endsWith('.png'));
    console.log(`\n📸 Uploading ${imgFiles.length} images to MongoDB...`);

    const batchSize = 100;
    for (let i = 0; i < imgFiles.length; i += batchSize) {
      const batch = imgFiles.slice(i, i + batchSize);
      const ops = batch.map(file => {
        const filePath = path.join(imgDir, file);
        const data = fs.readFileSync(filePath);
        return {
          updateOne: {
            filter: { _id: file },
            update: {
              $set: {
                _id: file,
                filename: file,
                contentType: 'image/jpeg',
                data: new Binary(data),
                size: data.length,
                updatedAt: new Date()
              }
            },
            upsert: true
          }
        };
      });
      await mediaCollection.bulkWrite(ops);
      process.stdout.write(`  Images: ${Math.min(i + batchSize, imgFiles.length)}/${imgFiles.length}\r`);
    }
    console.log(`\n✓ Uploaded ${imgFiles.length} images.`);
  }

  // 3. Migrate GIFs
  const gifDir = path.join(MEDIA_DIR, 'gif');
  if (fs.existsSync(gifDir)) {
    const gifFiles = fs.readdirSync(gifDir).filter(f => f.endsWith('.gif'));
    console.log(`\n🎬 Uploading ${gifFiles.length} GIFs to MongoDB...`);

    const batchSize = 50;
    for (let i = 0; i < gifFiles.length; i += batchSize) {
      const batch = gifFiles.slice(i, i + batchSize);
      const ops = batch.map(file => {
        const filePath = path.join(gifDir, file);
        const data = fs.readFileSync(filePath);
        return {
          updateOne: {
            filter: { _id: file },
            update: {
              $set: {
                _id: file,
                filename: file,
                contentType: 'image/gif',
                data: new Binary(data),
                size: data.length,
                updatedAt: new Date()
              }
            },
            upsert: true
          }
        };
      });
      await mediaCollection.bulkWrite(ops);
      process.stdout.write(`  GIFs: ${Math.min(i + batchSize, gifFiles.length)}/${gifFiles.length}\r`);
    }
    console.log(`\n✓ Uploaded ${gifFiles.length} GIFs.`);
  }

  // Create indexes
  await exercisesCollection.createIndex({ id: 1 });
  await exercisesCollection.createIndex({ bp: 1 });
  await exercisesCollection.createIndex({ eq: 1 });
  await exercisesCollection.createIndex({ tg: 1 });
  await mediaCollection.createIndex({ filename: 1 });
  console.log('\n✓ Created database indexes');

  // Print summary
  const totalExercises = await exercisesCollection.countDocuments();
  const totalMedia = await mediaCollection.countDocuments();
  console.log(`\n🎉 Migration completed successfully!`);
  console.log(`   - Exercises in DB: ${totalExercises}`);
  console.log(`   - Media files in DB: ${totalMedia}`);

  await client.close();
}

main().catch(err => {
  console.error('\n❌ Migration error:', err);
  process.exit(1);
});
