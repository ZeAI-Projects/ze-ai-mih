import os

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from src.routes.routes import api_router

load_dotenv()
app = FastAPI(title='ZeAI #MadeInIndia Hackathon API', version='1.0.0')
origins = [item.strip() for item in os.getenv('FRONTEND_ORIGINS', '').split(',') if item.strip()]
app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_methods=['GET', 'POST', 'PATCH', 'PUT', 'DELETE'],
    allow_headers=['Authorization', 'Content-Type', 'X-Registration-Token'],
    allow_credentials=False,
)
app.include_router(api_router)


@app.get('/health', tags=['Health'])
async def health():
    return {'status': 'ok'}
