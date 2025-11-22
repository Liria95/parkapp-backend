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

async function seedParkingData() {
  console.log('Iniciando seed de datos de estacionamiento...\n');

  try {
    const batch = db.batch();

    console.log('Creando zonas de estacionamiento...');
    
    const streetParkings: StreetParking[] = [
      { id: 'zone001', zoneName: 'Posadas - Centro' },
      { id: 'zone002', zoneName: 'Posadas - Costanera' },
      { id: 'zone003', zoneName: 'Posadas - Avenida Mitre' },
      { id: 'zone004', zoneName: 'Paraná - Centro' },
      { id: 'zone005', zoneName: 'Paraná - Parque Urquiza' },
      { id: 'zone006', zoneName: 'Concepción del Uruguay - Centro' },
      { id: 'zone007', zoneName: 'Neuquén Capital - Centro' },
      { id: 'zone008', zoneName: 'Neuquén Capital - Zona Comercial' },
      { id: 'zone009', zoneName: 'San Martín de los Andes - Centro' },
      { id: 'zone010', zoneName: 'Villa La Angostura - Centro' }
    ];

    for (const zone of streetParkings) {
      const ref = db.collection('streetParking').doc(zone.id);
      batch.set(ref, {
        zoneName: zone.zoneName,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
      });
      console.log(`  Zona creada: ${zone.zoneName}`);
    }

    console.log('\nCreando calles...');
    
    const streets: (Street & { feePerHour: number })[] = [
      {
        id: 'street001',
        streetParkingId: 'zone001',
        streetAddress: 'AV. SAN MARTÍN 1000-1100 (Centro)',
        latMin: -27.366800,
        latMax: -27.367200,
        lngMin: -55.895500,
        lngMax: -55.894500,
        totalSpaces: 15,
        availableSpaces: 15,
        feePerHour: 50
      },
      {
        id: 'street002',
        streetParkingId: 'zone001',
        streetAddress: 'CALLE BOLÍVAR 1500-1600 (Centro)',
        latMin: -27.368000,
        latMax: -27.368400,
        lngMin: -55.897000,
        lngMax: -55.896000,
        totalSpaces: 12,
        availableSpaces: 12,
        feePerHour: 50
      },
      {
        id: 'street003',
        streetParkingId: 'zone002',
        streetAddress: 'AV. COSTANERA MONSEÑOR KEMERER (Costanera)',
        latMin: -27.364000,
        latMax: -27.365000,
        lngMin: -55.893000,
        lngMax: -55.892000,
        totalSpaces: 20,
        availableSpaces: 20,
        feePerHour: 40
      },
      {
        id: 'street004',
        streetParkingId: 'zone003',
        streetAddress: 'AV. BARTOLOMÉ MITRE 2000-2100',
        latMin: -27.370000,
        latMax: -27.371000,
        lngMin: -55.898000,
        lngMax: -55.897000,
        totalSpaces: 18,
        availableSpaces: 18,
        feePerHour: 45
      },
      {
        id: 'street005',
        streetParkingId: 'zone003',
        streetAddress: 'AV. ROQUE SÁENZ PEÑA 1000-1100',
        latMin: -27.372000,
        latMax: -27.373000,
        lngMin: -55.899000,
        lngMax: -55.898000,
        totalSpaces: 16,
        availableSpaces: 16,
        feePerHour: 45
      },
      {
        id: 'street006',
        streetParkingId: 'zone004',
        streetAddress: 'CALLE SAN MARTÍN 500-600 (Centro)',
        latMin: -31.732000,
        latMax: -31.733000,
        lngMin: -60.528000,
        lngMax: -60.527000,
        totalSpaces: 14,
        availableSpaces: 14,
        feePerHour: 55
      },
      {
        id: 'street007',
        streetParkingId: 'zone004',
        streetAddress: 'AV. RIVADAVIA 100-200 (Centro)',
        latMin: -31.733500,
        latMax: -31.734500,
        lngMin: -60.529000,
        lngMax: -60.528000,
        totalSpaces: 16,
        availableSpaces: 16,
        feePerHour: 55
      },
      {
        id: 'street008',
        streetParkingId: 'zone005',
        streetAddress: 'AV. LAURENCENA (Parque Urquiza)',
        latMin: -31.738000,
        latMax: -31.739000,
        lngMin: -60.522000,
        lngMax: -60.521000,
        totalSpaces: 22,
        availableSpaces: 22,
        feePerHour: 45
      },
      {
        id: 'street009',
        streetParkingId: 'zone005',
        streetAddress: 'CALLE CORRIENTES (Parque Urquiza)',
        latMin: -31.739500,
        latMax: -31.740500,
        lngMin: -60.523000,
        lngMax: -60.522000,
        totalSpaces: 18,
        availableSpaces: 18,
        feePerHour: 45
      },
      {
        id: 'street010',
        streetParkingId: 'zone006',
        streetAddress: 'CALLE GALÁN (Concepción del Uruguay)',
        latMin: -32.484000,
        latMax: -32.485000,
        lngMin: -58.234000,
        lngMax: -58.233000,
        totalSpaces: 12,
        availableSpaces: 12,
        feePerHour: 50
      },
      {
        id: 'street011',
        streetParkingId: 'zone007',
        streetAddress: 'AV. ARGENTINA 100-200 (Centro)',
        latMin: -38.951000,
        latMax: -38.952000,
        lngMin: -68.059000,
        lngMax: -68.058000,
        totalSpaces: 20,
        availableSpaces: 20,
        feePerHour: 60
      },
      {
        id: 'street012',
        streetParkingId: 'zone007',
        streetAddress: 'CALLE SANTA FE 200-300 (Centro)',
        latMin: -38.952500,
        latMax: -38.953500,
        lngMin: -68.060000,
        lngMax: -68.059000,
        totalSpaces: 16,
        availableSpaces: 16,
        feePerHour: 60
      },
      {
        id: 'street013',
        streetParkingId: 'zone008',
        streetAddress: 'AV. OLASCOAGA 500-600 (Zona Comercial)',
        latMin: -38.954000,
        latMax: -38.955000,
        lngMin: -68.061000,
        lngMax: -68.060000,
        totalSpaces: 18,
        availableSpaces: 18,
        feePerHour: 50
      },
      {
        id: 'street014',
        streetParkingId: 'zone008',
        streetAddress: 'AV. ARRAYANES (Zona Comercial)',
        latMin: -38.956000,
        latMax: -38.957000,
        lngMin: -68.062000,
        lngMax: -68.061000,
        totalSpaces: 15,
        availableSpaces: 15,
        feePerHour: 50
      },
      {
        id: 'street015',
        streetParkingId: 'zone009',
        streetAddress: 'AV. SAN MARTÍN (Centro)',
        latMin: -40.157000,
        latMax: -40.158000,
        lngMin: -71.353000,
        lngMax: -71.352000,
        totalSpaces: 14,
        availableSpaces: 14,
        feePerHour: 70
      },
      {
        id: 'street016',
        streetParkingId: 'zone009',
        streetAddress: 'CALLE VILLEGAS (Centro)',
        latMin: -40.158500,
        latMax: -40.159500,
        lngMin: -71.354000,
        lngMax: -71.353000,
        totalSpaces: 12,
        availableSpaces: 12,
        feePerHour: 70
      },
      {
        id: 'street017',
        streetParkingId: 'zone010',
        streetAddress: 'AV. ARRAYANES (Centro)',
        latMin: -40.761000,
        latMax: -40.762000,
        lngMin: -71.664000,
        lngMax: -71.663000,
        totalSpaces: 10,
        availableSpaces: 10,
        feePerHour: 75
      },
      {
        id: 'street018',
        streetParkingId: 'zone010',
        streetAddress: 'AV. SIETE LAGOS (Centro)',
        latMin: -40.762500,
        latMax: -40.763500,
        lngMin: -71.665000,
        lngMax: -71.664000,
        totalSpaces: 12,
        availableSpaces: 12,
        feePerHour: 75
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

    console.log('\nCreando tarifas...');
    
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

    console.log('\nCreando espacios de estacionamiento...');
    
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
    console.log('Resumen de datos creados:');
    console.log(`   Zonas: ${streetParkings.length}`);
    console.log(`   Calles: ${streets.length}`);
    console.log(`   Tarifas: ${prices.length}`);
    console.log(`   Espacios: ${parkingSpaces.length}\n`);

    console.log('Los usuarios deben registrarse mediante la aplicación\n');

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
