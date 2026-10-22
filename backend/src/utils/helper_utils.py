from typing import Any


def success(data: Any, message: str = 'Success') -> dict[str, Any]:
    return {'status_code': 200, 'status_message': message, 'data': data}
