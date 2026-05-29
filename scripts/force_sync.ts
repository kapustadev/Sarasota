import { POST } from '../app/api/wp/sync-orders/route';

async function main() {
  console.log('Запускаем синхронизацию заказов...');
  try {
    const response = await POST();
    const data = await response.json();
    console.log('Результат синхронизации:', JSON.stringify(data, null, 2));
  } catch (error) {
    console.error('Ошибка при синхронизации:', error);
  }
}

main();
