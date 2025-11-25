import { db } from '../config/firebaseAdmin';
import admin from 'firebase-admin';

interface StreetParking {
  id: string;
  zoneName: string;
}

interface Street {
  id: string;
  streetParkingId: string;
  streetAddress: string;
  latMin: number;
  latMax: number;
  lngMin: number;
  lngMax: number;
  totalSpaces: number;
  availableSpaces: number;
}

interface Price {
  id: string;
  streetId: string;
  fee: number;
}

interface ParkingSpace {
  id: string;
  streetId: string;
  spaceCode: string;
  latitude: number;
  longitude: number;
  status: 'available' | 'occupied';
}

async function clearAllData() {
  console.log('Vaciando colecciones existentes...\n');

  const collections = ['parkingSpaces', 'price', 'streets', 'streetParking'];
  
  for (const collectionName of collections) {
    const snapshot = await db.collection(collectionName).get();
    const batch = db.batch();
    
    snapshot.docs.forEach((doc) => {
      batch.delete(doc.ref);
    });
    
    if (!snapshot.empty) {
      await batch.commit();
      console.log(`  ${collectionName}: ${snapshot.size} documentos eliminados`);
    }
  }
  
  console.log('\nColecciones vaciadas correctamente\n');
}

async function seedParkingData() {
  console.log('Iniciando seed de datos de estacionamiento reducido...\n');

  try {
    // Primero vaciar todo
    await clearAllData();

    const batch = db.batch();

    console.log('Creando 4 zonas de estacionamiento...');
    
    const streetParkings: StreetParking[] = [
      { id: 'zone001', zoneName: 'Campo Grande - Centro (Misiones)' },
      { id: 'zone002', zoneName: 'Parana - Centro (Entre Rios)' },
      { id: 'zone003', zoneName: 'Santa Fe - Centro (Santa Fe)' },
      { id: 'zone004', zoneName: 'Neuquen Capital - Centro (Neuquen)' }
    ];

    for (const zone of streetParkings) {
      const ref = db.collection('streetParking').doc(zone.id);
      batch.set(ref, {
        zoneName: zone.zoneName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  Zona creada: ${zone.zoneName}`);
    }

    console.log('\nCreando 4 calles (2 espacios cada una)...');
    
    const streets: (Street & { feePerHour: number })[] = [
      // CAMPO GRANDE - MISIONES (2 espacios)
      {
        id: 'street001',
        streetParkingId: 'zone001',
        streetAddress: 'RUTA PROVINCIAL 2 - CENTRO (Campo Grande, Misiones)',
        latMin: -27.432500,
        latMax: -27.433500,
        lngMin: -55.537500,
        lngMax: -55.536500,
        totalSpaces: 2,
        availableSpaces: 2,
        feePerHour: 40
      },
      // PARANA - ENTRE RIOS (2 espacios)
      {
        id: 'street002',
        streetParkingId: 'zone002',
        streetAddress: 'CALLE SAN MARTIN 500-600 - CENTRO (Parana, Entre Rios)',
        latMin: -31.732000,
        latMax: -31.733000,
        lngMin: -60.528000,
        lngMax: -60.527000,
        totalSpaces: 2,
        availableSpaces: 2,
        feePerHour: 55
      },
      // SANTA FE - SANTA FE (2 espacios)
      {
        id: 'street003',
        streetParkingId: 'zone003',
        streetAddress: 'AV. SAN MARTIN 2500-2600 - CENTRO (Santa Fe, Santa Fe)',
        latMin: -31.637000,
        latMax: -31.638000,
        lngMin: -60.699000,
        lngMax: -60.698000,
        totalSpaces: 2,
        availableSpaces: 2,
        feePerHour: 50
      },
      // NEUQUEN CAPITAL - NEUQUEN (2 espacios)
      {
        id: 'street004',
        streetParkingId: 'zone004',
        streetAddress: 'AV. ARGENTINA 100-200 - CENTRO (Neuquen Capital, Neuquen)',
        latMin: -38.951000,
        latMax: -38.952000,
        lngMin: -68.059000,
        lngMax: -68.058000,
        totalSpaces: 2,
        availableSpaces: 2,
        feePerHour: 60
      }
    ];

    for (const street of streets) {
      const { id, feePerHour, ...streetData } = street;
      const ref = db.collection('streets').doc(id);
      batch.set(ref, {
        ...streetData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  Calle creada: ${street.streetAddress}`);
    }

    console.log('\nCreando 4 tarifas...');
    
    const prices: Price[] = [];
    let priceCounter = 1;

    for (const street of streets) {
      prices.push({
        id: `price${String(priceCounter).padStart(3, '0')}`,
        streetId: street.id,
        fee: street.feePerHour
      });
      priceCounter++;
    }

    for (const price of prices) {
      const { id, ...priceData } = price;
      const ref = db.collection('price').doc(id);
      batch.set(ref, {
        ...priceData,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log(`  ${prices.length} tarifas creadas`);

    console.log('\nCreando 8 espacios de estacionamiento (2 por calle)...');
    
    const parkingSpaces: ParkingSpace[] = [];
    let spaceCounter = 1;

    for (const street of streets) {
      const spacesCount = street.totalSpaces;
      const latStep = (street.latMax - street.latMin) / spacesCount;
      const lngStep = (street.lngMax - street.lngMin) / spacesCount;

      for (let i = 0; i < spacesCount; i++) {
        const spaceCode = `SP-${String(spaceCounter).padStart(4, '0')}`;
        const latitude = street.latMin + (latStep * i);
        const longitude = street.lngMin + (lngStep * i);

        parkingSpaces.push({
          id: `space${String(spaceCounter).padStart(4, '0')}`,
          streetId: street.id,
          spaceCode,
          latitude,
          longitude,
          status: 'available'
        });

        spaceCounter++;
      }
    }

    for (const space of parkingSpaces) {
      const { id, ...spaceData } = space;
      const ref = db.collection('parkingSpaces').doc(id);
      batch.set(ref, {
        ...spaceData,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        updatedAt: admin.firestore.FieldValue.serverTimestamp()
      });
    }
    console.log(`  ${parkingSpaces.length} espacios creados`);

    console.log('\nGuardando datos en Firestore...');
    await batch.commit();

    console.log('\nSeed completado exitosamente\n');
    console.log('=================================');
    console.log('RESUMEN DE DATOS CREADOS:');
    console.log('=================================');
    console.log(`Zonas: ${streetParkings.length}`);
    console.log(`Calles: ${streets.length}`);
    console.log(`Tarifas: ${prices.length}`);
    console.log(`Espacios: ${parkingSpaces.length}`);
    console.log('=================================\n');

    console.log('DETALLES POR PROVINCIA:');
    console.log('- Campo Grande (Misiones): 2 espacios');
    console.log('- Parana (Entre Rios): 2 espacios');
    console.log('- Santa Fe (Santa Fe): 2 espacios');
    console.log('- Neuquen Capital (Neuquen): 2 espacios\n');

  } catch (error) {
    console.error('Error al hacer seed:', error);
    throw error;
  }
}

seedParkingData()
  .then(() => {
    console.log('Script finalizado correctamente');
    process.exit(0);
  })
  .catch((error) => {
    console.error('Error fatal:', error);
    process.exit(1);
  });