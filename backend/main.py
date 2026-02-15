# =============================================================================
# BACKEND - FastAPI Server
# =============================================================================
# Этот файл создаёт API сервер который отвечает на запросы от фронтенда
# Работает с DuckDB и возвращает данные в формате JSON
# =============================================================================

from fastapi import FastAPI, HTTPException, Query
from fastapi.middleware.cors import CORSMiddleware
from typing import Optional, List
import duckdb
import os
from datetime import datetime

# Импортируем функции для работы с БД
from database import (
    get_routes_list,
    get_route_schedule,
    get_stops_for_route,
    get_intervals_for_stop,
    get_trip_durations
)

# =============================================================================
# Создание приложения FastAPI
# =============================================================================

app = FastAPI(
    title="GTFS Moscow API",
    description="API для расписания общественного транспорта Москвы",
    version="1.0.0"
)

# =============================================================================
# CORS (Cross-Origin Resource Sharing)
# =============================================================================
# Позволяет фронтенду (Vercel) делать запросы к бэкенду (Render)
# Без этого браузер заблокирует запросы из-за разных доменов

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Разрешаем запросы с любых доменов
    allow_credentials=True,
    allow_methods=["*"],  # Разрешаем все HTTP методы (GET, POST, etc)
    allow_headers=["*"],  # Разрешаем все заголовки
)

# =============================================================================
# ENDPOINTS (API точки доступа)
# =============================================================================

@app.get("/")
async def root():
    """
    Главная страница API - просто проверка что сервер работает
    """
    return {
        "message": "GTFS Moscow API is running",
        "status": "ok",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/health")
async def health_check():
    """
    Эндпоинт для проверки здоровья сервера
    Используется для мониторинга и "пробуждения" сервера
    """
    return {
        "status": "healthy",
        "timestamp": datetime.now().isoformat()
    }

@app.get("/api/routes")
async def get_routes():
    """
    Получить список всех маршрутов
    
    Возвращает:
        List[dict]: Список маршрутов с полями:
            - route_short_name: Номер маршрута (например, "1")
            - route_long_name: Полное название (например, "Метро Китай-город - ...")
            - route_id: ID маршрута в базе
    
    Пример ответа:
    [
        {
            "route_short_name": "1",
            "route_long_name": "Метро «Китай-город» - Чистопрудный бульвар",
            "route_id": "4126"
        },
        ...
    ]
    """
    try:
        routes = get_routes_list()
        return {"routes": routes, "count": len(routes)}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения маршрутов: {str(e)}")

@app.get("/api/route/{route_short_name}/stops")
async def get_stops(
    route_short_name: str,
    direction: int = Query(0, description="Направление: 0 - прямое, 1 - обратное")
):
    """
    Получить список остановок для маршрута
    
    Параметры:
        route_short_name: Номер маршрута (например, "1")
        direction: 0 для прямого направления, 1 для обратного
    
    Возвращает:
        List[dict]: Список остановок по порядку
    
    Пример: GET /api/route/1/stops?direction=0
    """
    try:
        stops = get_stops_for_route(route_short_name, direction)
        
        if not stops:
            raise HTTPException(
                status_code=404, 
                detail=f"Маршрут {route_short_name} не найден или нет остановок"
            )
        
        return {
            "route": route_short_name,
            "direction": direction,
            "stops": stops,
            "count": len(stops)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения остановок: {str(e)}")

@app.get("/api/route/{route_short_name}/schedule")
async def get_schedule(
    route_short_name: str,
    stop_name: str = Query(..., description="Название остановки"),
    direction: int = Query(0, description="Направление: 0 - прямое, 1 - обратное"),
    day_type: str = Query("weekday", description="Тип дня: weekday или weekend")
):
    """
    Получить расписание для конкретной остановки
    
    Параметры:
        route_short_name: Номер маршрута
        stop_name: Название остановки (точное совпадение)
        direction: Направление (0 или 1)
        day_type: "weekday" для будней, "weekend" для выходных
    
    Возвращает:
        dict: Расписание с временами прибытия
    
    Пример: GET /api/route/1/schedule?stop_name=Метро+Китай-город&direction=0&day_type=weekday
    """
    try:
        schedule = get_route_schedule(route_short_name, stop_name, direction, day_type)
        
        if not schedule:
            raise HTTPException(
                status_code=404,
                detail=f"Расписание не найдено для остановки {stop_name}"
            )
        
        return {
            "route": route_short_name,
            "stop": stop_name,
            "direction": direction,
            "day_type": day_type,
            "schedule": schedule,
            "count": len(schedule)
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения расписания: {str(e)}")

@app.get("/api/route/{route_short_name}/intervals")
async def get_intervals(
    route_short_name: str,
    stop_name: str = Query(..., description="Название остановки"),
    direction: int = Query(0, description="Направление"),
    day_type: str = Query("weekday", description="Тип дня")
):
    """
    Получить интервалы движения по часам для остановки
    
    Используется для построения круговых графиков интервалов
    
    Возвращает:
        dict: Интервалы по часам (мин и макс для каждого часа)
    
    Пример ответа:
    {
        "hours": [0, 1, 2, ..., 23],
        "min_intervals": [10, 12, 15, ...],
        "max_intervals": [20, 25, 30, ...]
    }
    """
    try:
        intervals = get_intervals_for_stop(route_short_name, stop_name, direction, day_type)
        
        if not intervals:
            raise HTTPException(
                status_code=404,
                detail=f"Интервалы не найдены для остановки {stop_name}"
            )
        
        return {
            "route": route_short_name,
            "stop": stop_name,
            "direction": direction,
            "day_type": day_type,
            "intervals": intervals
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения интервалов: {str(e)}")

@app.get("/api/route/{route_short_name}/durations")
async def get_durations(
    route_short_name: str,
    direction: int = Query(0, description="Направление"),
    day_type: str = Query("weekday", description="Тип дня")
):
    """
    Получить время выполнения рейсов (от первой до последней остановки)
    
    Возвращает:
        dict: Статистика времени рейсов
    
    Пример ответа:
    {
        "average": 45.5,
        "min": 38,
        "max": 60,
        "trips": [
            {"first_time": "06:00", "last_time": "06:45", "duration": 45},
            ...
        ]
    }
    """
    try:
        durations = get_trip_durations(route_short_name, direction, day_type)
        
        if not durations:
            raise HTTPException(
                status_code=404,
                detail=f"Данные о длительности рейсов не найдены"
            )
        
        return {
            "route": route_short_name,
            "direction": direction,
            "day_type": day_type,
            "durations": durations
        }
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Ошибка получения времени рейсов: {str(e)}")

# =============================================================================
# Запуск сервера (только для локальной разработки)
# =============================================================================
# На Render используется команда: uvicorn main:app --host 0.0.0.0 --port $PORT

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True  # Автоперезагрузка при изменении кода
    )
