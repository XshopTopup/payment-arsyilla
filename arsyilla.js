const createPakasirClient = require('pakasir-sdk');

const ArsyillaSlug = 'arsyilla';
const ArsyillaApikey = 'b6fFuc6r4L7nB7407qcql085pSvgcPa3';

const arsyillaClient = createPakasirClient(
  ArsyillaSlug,
  ArsyillaApikey
);

async function createQrisPayment(orderId, amount) {
  try {
    return await arsyillaClient.createTransaction(orderId, amount, 'qris');
  } catch (error) {
    console.error('Gagal membuat QRIS:', error.message);
    throw error;
  }
}

async function checkStatus(orderId, amount) {
  try {
    return await arsyillaClient.transactionDetail(orderId, amount);
  } catch (error) {
    console.error('Gagal cek status:', error.message);
    throw error;
  }
}

async function cancelPayment(orderId, amount) {
  try {
    return await arsyillaClient.transactionCancel(orderId, amount);
  } catch (error) {
    console.error('Gagal membatalkan transaksi:', error.message);
    throw error;
  }
}

module.exports = {
  createQrisPayment,
  checkStatus,
  cancelPayment
};
