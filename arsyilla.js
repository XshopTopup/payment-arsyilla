const Arsyilla = require('pakasir-sdk');

const ArsyillaSlug = 'arsyilla';
const ArsyillaApikey = 'b6fFuC6r4L7nB74Q7qcqlO85pSvGcPa3';

const arsyillaClient = new Arsyilla(ArsyillaSlug, ArsyillaApikey);

async function createQrisPayment(orderId, amount) {
    try {
        return await arsyillaClient.createTransaction(orderId, amount, 'qris');
    } catch (error) {
        console.error("Gagal membuat QRIS:", error.message);
        throw error;
    }
}

async function checkStatus(orderId, amount) {
    try {
        return await arsyillaClient.transactionDetail(orderId, amount);
    } catch (error) {
        console.error("Gagal cek status:", error.message);
        throw error;
    }
}

async function cancelPayment(orderId, amount) {
    try {
        return await arsyillaClient.transactionCancel(orderId, amount);
    } catch (error) {
        console.error("Gagal membatalkan transaksi:", error.message);
        throw error;
    }
}

module.exports = {
    createQrisPayment,
    checkStatus,
    cancelPayment
};
