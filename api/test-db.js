// Endpoint de test pour vérifier la connexion à la base de données
// URL: https://votre-site.vercel.app/api/test-db
// Usage: Pour vérifier que Postgres fonctionne correctement

import { sql } from '@vercel/postgres';
import { getUserCount, getStats } from '../lib/db.js';

export default async function handler(req, res) {
  try {
    // Test 1: Connexion basique
    console.log('🧪 Test 1: Vérification de la connexion...');
    const connectionTest = await sql`SELECT NOW() as current_time`;
    const currentTime = connectionTest.rows[0].current_time;

    // Test 2: Vérifier que la table users existe
    console.log('🧪 Test 2: Vérification de la table users...');
    const tableCheck = await sql`
      SELECT EXISTS (
        SELECT FROM information_schema.tables
        WHERE table_name = 'users'
      ) as table_exists
    `;
    const tableExists = tableCheck.rows[0].table_exists;

    // Test 3: Compter les utilisateurs
    console.log('🧪 Test 3: Comptage des utilisateurs...');
    let userCount = 0;
    let stats = null;

    if (tableExists) {
      userCount = await getUserCount();
      stats = await getStats();
    }

    // Test 4: Lister les colonnes de la table users
    console.log('🧪 Test 4: Structure de la table...');
    let columns = [];

    if (tableExists) {
      const columnsResult = await sql`
        SELECT column_name, data_type, is_nullable
        FROM information_schema.columns
        WHERE table_name = 'users'
        ORDER BY ordinal_position
      `;
      columns = columnsResult.rows;
    }

    // Test 5: Vérifier les index
    console.log('🧪 Test 5: Vérification des index...');
    let indexes = [];

    if (tableExists) {
      const indexesResult = await sql`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'users'
      `;
      indexes = indexesResult.rows;
    }

    console.log('✅ Tous les tests réussis');

    return res.status(200).json({
      success: true,
      message: 'Connexion à la base de données réussie',
      timestamp: new Date().toISOString(),
      tests: {
        connection: {
          status: '✅ OK',
          serverTime: currentTime
        },
        table: {
          status: tableExists ? '✅ Existe' : '❌ Manquante',
          name: 'users',
          needsSetup: !tableExists
        },
        data: tableExists ? {
          status: '✅ OK',
          userCount,
          stats
        } : {
          status: '⚠️ Table non créée',
          message: 'Exécutez /api/setup-db pour créer la table'
        },
        structure: tableExists ? {
          status: '✅ OK',
          columnsCount: columns.length,
          columns: columns.map(c => ({
            name: c.column_name,
            type: c.data_type,
            nullable: c.is_nullable === 'YES'
          }))
        } : null,
        indexes: tableExists ? {
          status: '✅ OK',
          count: indexes.length,
          list: indexes.map(i => i.indexname)
        } : null
      },
      nextSteps: !tableExists ? [
        '1. Ajoutez la variable SETUP_KEY dans les variables d\'environnement',
        '2. Visitez /api/setup-db?key=VOTRE_CLE pour créer la table',
        '3. Relancez ce test pour vérifier'
      ] : [
        '✅ Tout est configuré correctement !',
        'Vous pouvez commencer à utiliser la base de données.'
      ]
    });

  } catch (error) {
    console.error('❌ Erreur lors des tests:', error);

    return res.status(500).json({
      success: false,
      error: 'Erreur lors de la vérification de la base de données',
      message: error.message,
      timestamp: new Date().toISOString(),
      help: [
        '1. Vérifiez que Vercel Postgres est configuré',
        '2. Vérifiez que la database est connectée au projet',
        '3. Vérifiez les variables d\'environnement (POSTGRES_URL, etc.)',
        '4. Consultez les logs Vercel pour plus de détails'
      ],
      documentation: 'Voir SETUP_POSTGRES.md pour le guide complet'
    });
  }
}
