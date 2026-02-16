# =============================================================================
# DATABASE - Работа с DuckDB
# =============================================================================
# Этот файл содержит все функции для работы с базой данных DuckDB
# Все SQL запросы и обработка данных находятся здесь
# =============================================================================

import duckdb
import pandas as pd
import os
from typing import List, Dict, Optional

# =============================================================================
# ПУТЬ К БАЗЕ ДАННЫХ
# =============================================================================

# Определяем путь к базе данных
# В продакшене (Render) БД будет находиться в корневой папке проекта
DB_PATH = os.environ.get('DB_PATH', 'gtfs_transport.duckdb')

# Проверяем существует ли БД
if not os.path.exists(DB_PATH):
    print(f"⚠️ ВНИМАНИЕ: База данных не найдена по пути {DB_PATH}")
    print("Создайте БД с помощью init_db.py или загрузите gtfs_transport.duckdb")

# =============================================================================
# ВСПОМОГАТЕЛЬНЫЕ ФУНКЦИИ
# =============================================================================

def get_connection():
    """
    Создаёт подключение к DuckDB
    
    Returns:
        duckdb.DuckDBPyConnection: Подключение к БД
    """
    try:
        con = duckdb.connect(DB_PATH, read_only=True)
        return con
    except Exception as e:
        print(f"❌ Ошибка подключения к БД: {e}")
        raise

def normalize_time(time_str: str) -> Optional[str]:
    """
    Нормализует время (24+ часов → 0-23)
    
    Например: "25:30:00" → "01:30:00"
    """
    if pd.isna(time_str):
        return None
    try:
        parts = str(time_str).split(':')
        hours = int(parts[0])
        if hours >= 24:
            hours = hours - 24
        return f"{hours:02d}:{parts[1]}:{parts[2]}"
    except:
        return None

def get_sort_key(time_str: str) -> int:
    """
    Создаёт ключ сортировки для времени (начало дня = 4:00)
    
    Используется для правильной сортировки расписания
    где транспортные сутки начинаются в 4:00
    """
    try:
        h, m = map(int, time_str.split(':')[:2])
        return (h * 60 + m + 24*60 - 4*60) % (24*60)
    except:
        return 9999

# =============================================================================
# ОСНОВНЫЕ ФУНКЦИИ API
# =============================================================================

def get_routes_list() -> List[Dict]:
    """
    Получить список всех маршрутов
    
    Returns:
        List[Dict]: Список маршрутов
    """
    con = get_connection()
    
    query = """
        SELECT DISTINCT
            route_short_name,
            route_long_name,
            route_id
        FROM routes
        ORDER BY 
            CASE 
                WHEN route_short_name ~ '^[0-9]+$' 
                THEN CAST(route_short_name AS INTEGER)
                ELSE 999999
            END,
            route_short_name
    """
    
    df = con.execute(query).df()
    con.close()
    
    return df.to_dict('records')

def get_stops_for_route(route_short_name: str, direction: int) -> List[Dict]:
    """
    Получить список остановок для маршрута в определённом направлении
    
    Args:
        route_short_name: Номер маршрута
        direction: 0 - прямое, 1 - обратное
    
    Returns:
        List[Dict]: Список остановок по порядку
    """
    con = get_connection()
    
    # Получаем route_id
    route_query = """
        SELECT route_id 
        FROM routes 
        WHERE route_short_name = ?
    """
    route_df = con.execute(route_query, [route_short_name]).df()
    
    if route_df.empty:
        con.close()
        return []
    
    route_id = str(route_df.iloc[0]['route_id'])
    direction_id = str(direction)
    
    # Получаем остановки
    query = """
        WITH route_trips AS (
            SELECT DISTINCT trip_id
            FROM trips
            WHERE CAST(route_id AS VARCHAR) = ?
              AND CAST(direction_id AS VARCHAR) = ?
        ),
        stop_sequences AS (
            SELECT DISTINCT
                st.stop_id,
                MIN(st.stop_sequence) as min_sequence
            FROM stop_times st
            WHERE st.trip_id IN (SELECT trip_id FROM route_trips)
            GROUP BY st.stop_id
        )
        SELECT 
            s.stop_id,
            s.stop_name,
            s.stop_lat,
            s.stop_lon,
            ss.min_sequence as stop_sequence
        FROM stop_sequences ss
        JOIN stops s ON ss.stop_id = s.stop_id
        ORDER BY ss.min_sequence
    """
    
    df = con.execute(query, [route_id, direction_id]).df()
    con.close()
    
    return df.to_dict('records')

def get_route_schedule(
    route_short_name: str, 
    stop_name: str, 
    direction: int, 
    day_type: str
) -> List[str]:
    """
    Получить расписание для конкретной остановки
    
    Args:
        route_short_name: Номер маршрута
        stop_name: Название остановки
        direction: Направление (0 или 1)
        day_type: "weekday" или "weekend"
    
    Returns:
        List[str]: Отсортированный список времён прибытия
    """
    try:
        con = get_connection()
        
        # Получаем route_id
        route_df = con.execute(
            "SELECT route_id FROM routes WHERE route_short_name = ?",
            [route_short_name]
        ).df()
        
        if route_df.empty:
            con.close()
            return []
        
        route_id = str(route_df.iloc[0]['route_id'])
        direction_id = str(direction)
        day_column = 'monday' if day_type == 'weekday' else 'sunday'
        
        # Получаем расписание
        query = f"""
            WITH valid_services AS (
                SELECT CAST(service_id AS VARCHAR) as service_id
                FROM calendar 
                WHERE {day_column} = 1
            ),
            route_trips AS (
                SELECT DISTINCT t.trip_id
                FROM trips t
                WHERE CAST(t.route_id AS VARCHAR) = ?
                  AND CAST(t.direction_id AS VARCHAR) = ?
                  AND CAST(t.service_id AS VARCHAR) IN (SELECT service_id FROM valid_services)
            ),
            stop_ids AS (
                SELECT CAST(stop_id AS VARCHAR) as stop_id
                FROM stops
                WHERE stop_name = ?
            )
            SELECT DISTINCT st.arrival_time
            FROM stop_times st
            WHERE st.trip_id IN (SELECT trip_id FROM route_trips)
              AND CAST(st.stop_id AS VARCHAR) IN (SELECT stop_id FROM stop_ids)
            ORDER BY st.arrival_time
        """
        
        df = con.execute(query, [route_id, direction_id, stop_name]).df()
        con.close()
        
        # Нормализуем время и сортируем
        times = []
        for time_str in df['arrival_time'].tolist():
            normalized = normalize_time(time_str)
            if normalized:
                times.append({
                    'time': normalized,
                    'sort_key': get_sort_key(normalized)
                })
        
        # Сортируем и удаляем дубликаты
        times_sorted = sorted(times, key=lambda x: x['sort_key'])
        unique_times = []
        seen = set()
        
        for item in times_sorted:
            if item['time'] not in seen:
                unique_times.append(item['time'])
                seen.add(item['time'])
        
        return unique_times
    except Exception as e:
        print(f"❌ Ошибка в get_route_schedule: {e}")
        import traceback
        traceback.print_exc()
        return []

def get_intervals_for_stop(
    route_short_name: str,
    stop_name: str,
    direction: int,
    day_type: str
) -> Optional[Dict]:
    """
    Рассчитать интервалы движения по часам
    
    Returns:
        Dict: {
            'hours': [0, 1, ..., 23],
            'min_intervals': [...],
            'max_intervals': [...]
        }
    """
    # Получаем расписание
    schedule = get_route_schedule(route_short_name, stop_name, direction, day_type)
    
    if not schedule:
        return None
    
    # Группируем по часам и рассчитываем интервалы
    hourly_intervals = {h: [] for h in range(24)}
    
    for i in range(1, len(schedule)):
        try:
            t1 = get_sort_key(schedule[i-1])
            t2 = get_sort_key(schedule[i])
            hour = int(schedule[i].split(':')[0])
            
            interval = t2 - t1
            if 0 < interval < 180:  # Игнорируем интервалы > 3 часов
                hourly_intervals[hour].append(interval)
        except:
            continue
    
    # Формируем результат
    hours = list(range(24))
    min_intervals = []
    max_intervals = []
    
    for h in hours:
        if hourly_intervals[h]:
            min_intervals.append(min(hourly_intervals[h]))
            max_intervals.append(max(hourly_intervals[h]))
        else:
            min_intervals.append(0)
            max_intervals.append(0)
    
    return {
        'hours': hours,
        'min_intervals': min_intervals,
        'max_intervals': max_intervals
    }

def get_trip_durations(
    route_short_name: str,
    direction: int,
    day_type: str
) -> Optional[Dict]:
    """
    Рассчитать время выполнения рейсов
    
    Returns:
        Dict: Статистика и список рейсов с временем
    """
    con = get_connection()
    
    # Получаем route_id
    route_df = con.execute(
        "SELECT route_id FROM routes WHERE route_short_name = ?",
        [route_short_name]
    ).df()
    
    if route_df.empty:
        con.close()
        return None
    
    route_id = str(route_df.iloc[0]['route_id'])
    direction_id = str(direction)
    day_column = 'monday' if day_type == 'weekday' else 'sunday'
    
    # Получаем рейсы
    query = f"""
        WITH valid_services AS (
            SELECT CAST(service_id AS VARCHAR) as service_id
            FROM calendar 
            WHERE {day_column} = 1
        ),
        route_trips AS (
            SELECT trip_id
            FROM trips
            WHERE CAST(route_id AS VARCHAR) = ?
              AND CAST(direction_id AS VARCHAR) = ?
              AND CAST(service_id AS VARCHAR) IN (SELECT service_id FROM valid_services)
        )
        SELECT 
            st.trip_id,
            MIN(st.arrival_time) as first_time,
            MAX(st.arrival_time) as last_time
        FROM stop_times st
        WHERE st.trip_id IN (SELECT trip_id FROM route_trips)
        GROUP BY st.trip_id
        HAVING COUNT(*) > 1
    """
    
    df = con.execute(query, [route_id, direction_id]).df()
    con.close()
    
    if df.empty:
        return None
    
    # Рассчитываем длительность
    durations = []
    
    for _, row in df.iterrows():
        try:
            first = row['first_time']
            last = row['last_time']
            
            # Конвертируем в минуты
            h1, m1 = map(int, str(first).split(':')[:2])
            h2, m2 = map(int, str(last).split(':')[:2])
            
            duration = (h2 * 60 + m2) - (h1 * 60 + m1)
            
            if 0 < duration < 300:  # Игнорируем > 5 часов
                durations.append({
                    'first_time': normalize_time(first),
                    'last_time': normalize_time(last),
                    'duration': duration
                })
        except:
            continue
    
    if not durations:
        return None
    
    # Статистика
    duration_values = [d['duration'] for d in durations]
    
    return {
        'average': sum(duration_values) / len(duration_values),
        'min': min(duration_values),
        'max': max(duration_values),
        'count': len(durations),
        'trips': durations[:50]  # Ограничиваем для производительности
    }

# =============================================================================
# ИНИЦИАЛИЗАЦИЯ БД (если нужно создать из CSV)
# =============================================================================

def init_database_from_csv(csv_folder_path: str):
    """
    Создаёт DuckDB базу из CSV файлов
    
    Используется при первом деплое на Render
    """
    print(f"📦 Создаём базу данных из CSV файлов в {csv_folder_path}")
    
    con = duckdb.connect(DB_PATH)
    
    # Список файлов и таблиц
    files = {
        'stops': 'data-60662.csv',
        'routes': 'data-60664.csv',
        'calendar': 'data-60666.csv',
        'trips': 'data-60665.csv',
        'stop_times': 'data-60661-extract.csv'
    }
    
    for table, filename in files.items():
        filepath = os.path.join(csv_folder_path, filename)
        
        if not os.path.exists(filepath):
            print(f"⚠️ Файл {filename} не найден, пропускаем")
            continue
        
        print(f"📊 Загружаем {table} из {filename}...")
        
        # Определяем разделитель
        delimiter = ';' if table != 'trips' else ';'
        
        con.execute(f"""
            CREATE TABLE IF NOT EXISTS {table} AS 
            SELECT * FROM read_csv_auto('{filepath}', 
                delim='{delimiter}',
                header=true,
                normalize_names=true,
                ignore_errors=true)
        """)
        
        count = con.execute(f"SELECT COUNT(*) FROM {table}").fetchone()[0]
        print(f"✅ {table}: {count:,} записей")
    
    # Создаём индексы
    print("🔧 Создаём индексы...")
    
    indexes = [
        "CREATE INDEX IF NOT EXISTS idx_trips_route ON trips(route_id)",
        "CREATE INDEX IF NOT EXISTS idx_trips_direction ON trips(direction_id)",
        "CREATE INDEX IF NOT EXISTS idx_stop_times_trip ON stop_times(trip_id)",
        "CREATE INDEX IF NOT EXISTS idx_stop_times_stop ON stop_times(stop_id)",
    ]
    
    for idx in indexes:
        con.execute(idx)
    
    con.close()
    print("🎉 База данных создана успешно!")

# =============================================================================
# Тест подключения
# =============================================================================

if __name__ == "__main__":
    print("🧪 Тестирование подключения к БД...")
    
    try:
        routes = get_routes_list()
        print(f"✅ Найдено маршрутов: {len(routes)}")
        print(f"Первые 5: {[r['route_short_name'] for r in routes[:5]]}")
    except Exception as e:
        print(f"❌ Ошибка: {e}")
