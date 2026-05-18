// Daily Firestore export to Cloud Storage. Runs at 04:00 America/New_York.
//
// Setup (one-time per Firebase project):
//   gcloud projects add-iam-policy-binding <PROJECT_ID> \
//     --member="serviceAccount:<PROJECT_ID>@appspot.gserviceaccount.com" \
//     --role="roles/datastore.importExportAdmin"
//   gsutil mb -p <PROJECT_ID> -c standard -l us-central1 gs://<PROJECT_ID>-backups
//
// Free tier: Cloud Storage gives 5 GB. Firestore exports of a small project
// are tiny (KB to MB). Lifecycle policy below auto-deletes after 30 days.

import { onSchedule } from 'firebase-functions/v2/scheduler';
import { logger } from 'firebase-functions/v2';
import admin from 'firebase-admin';

if (!admin.apps.length) admin.initializeApp();

export const dailyFirestoreBackup = onSchedule(
  {
    schedule: '0 4 * * *',
    timeZone: 'America/New_York',
    region: 'us-central1',
    retryCount: 3,
  },
  async () => {
    const projectId = process.env.GCLOUD_PROJECT;
    const bucket = `gs://${projectId}-backups`;
    const stamp = new Date().toISOString().slice(0, 10);
    const outputUriPrefix = `${bucket}/firestore/${stamp}`;

    const client = new admin.firestore.v1.FirestoreAdminClient();
    const databaseName = client.databasePath(projectId, '(default)');

    logger.info('Starting Firestore export', { outputUriPrefix });
    const [operation] = await client.exportDocuments({
      name: databaseName,
      outputUriPrefix,
      collectionIds: [], // empty = export everything
    });
    logger.info('Export operation kicked off', { name: operation.name });
  }
);
