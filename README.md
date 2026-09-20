# OLDINDAN Web

Frontend for OLDINDAN

## Setup

npm install

## Run

npm run dev

## Build

npm run build

# OLDINDAN Partner Web Clean

Bu versiya qaytadan yozilgan.
Keraksiz demo sahifa yo'q.
Backend endpointlarga to'g'ridan-to'g'ri ulanadi.

## Endpointlar

- POST /api/auth/login/
- GET /api/users/me/
- GET /api/restaurants/branches/
- GET /api/restaurants/branches/:id/
- GET /api/restaurants/zones/?branch\_\_id=ID
- POST /api/restaurants/zones/
- GET /api/restaurants/tables/?zone**branch**id=ID
- POST /api/restaurants/tables/
- GET /api/bookings/
- PATCH /api/bookings/:id/
- POST /api/bookings/:id/cancel/

## Ishga tushirish

npm install
npm run dev

## API base URL

- .env dagi VITE_API_BASE_URL bo'lsa shuni oladi
- bo'lmasa http://127.0.0.1:8000/api ishlaydi
