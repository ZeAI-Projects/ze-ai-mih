from fastapi import APIRouter

from src.routes.admin_routes import router as admin_router
from src.routes.admin_management_routes import router as admin_management_router

from src.routes.admin_ops_routes import router as admin_ops_router
from src.routes.public_routes import router as public_router
from src.routes.registration_routes import router as registration_router

from src.routes.admin_auth_routes import router as auth_router

api_router = APIRouter(prefix='/api/v1')
api_router.include_router(admin_router)
api_router.include_router(admin_management_router)

api_router.include_router(admin_ops_router)
api_router.include_router(public_router)
api_router.include_router(registration_router)

api_router.include_router(auth_router)

from src.routes.problem_statement_routes import router as problem_statement_router
api_router.include_router(problem_statement_router)
