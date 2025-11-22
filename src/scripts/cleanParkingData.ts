import { db } from '../config/firebaseAdmin';

async function cleanParkingOnly() {
  console.log('Limpiando SOLO datos de estacionamiento...\n');

  try {
    // Ahora son 4 colecciones (agregué price)
    const collections = [
      'parkingSpaces',
      'streets',
      'streetParking'
    ];

    for (const collectionName of collections) {
      console.log(`Limpiando colección: ${collectionName}...`);
      
      const snapshot = await db.collection(collectionName).get();
      
      if (snapshot.empty) {
        console.log(`La colección ${collectionName} ya está vacía`);
        continue;
      }

      console.log(`Documentos encontrados: ${snapshot.size}`);
      
      let batch = db.batch();
      let count = 0;
      let totalDeleted = 0;

      for (const doc of snapshot.docs) {
        batch.delete(doc.ref);
        count++;
        totalDeleted++;

        if (count === 500) {
          await batch.commit();
          console.log(`Eliminados ${totalDeleted} documentos...`);
          batch = db.batch();
          count = 0;
        }
      }

      if (count > 0) {
        await batch.commit();
        console.log(`Total eliminados: ${totalDeleted} documentos`);
      }
    }

    console.log('\nDatos de estacionamiento limpiados correctamente\n');

  } catch (error) {
    console.error('Error:', error);
    throw error;
  }
}

cleanParkingOnly()
  .then(() => {
    console.log('Script finalizado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });
