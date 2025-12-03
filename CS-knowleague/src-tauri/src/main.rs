#![cfg_attr(not(debug_assertions), windows_subsystem = "windows")]

use futures::stream::TryStreamExt;
use mongodb::{
    bson::{doc, oid::ObjectId}, // Добавили doc! макрос
    options::ClientOptions,
    Client,
};
use serde::{Deserialize, Serialize};
use std::sync::Mutex;
use tauri::State;

// --- СТРУКТУРЫ ДАННЫХ ---

#[derive(Debug, Serialize, Deserialize)]
pub struct Note {
    #[serde(rename = "_id", skip_serializing_if = "Option::is_none")]
    pub id: Option<ObjectId>,
    pub title: String,
    pub content: String,
    pub tags: Vec<String>,
}

struct AppState {
    db: Mutex<Option<Client>>,
}

// --- КОМАНДЫ (API) ---

// 1. Создать заметку
#[tauri::command]
async fn create_note(
    state: State<'_, AppState>,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<String, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    let db = client.database("knowledge_base");
    let collection = db.collection::<Note>("notes");

    let new_note = Note {
        id: None,
        title,
        content,
        tags,
    };

    // ИСПРАВЛЕНИЕ 1: Убрали None (options)
    match collection.insert_one(new_note).await {
        Ok(insert_result) => {
            let new_id = insert_result
                .inserted_id
                .as_object_id()
                .unwrap()
                .to_string();
            Ok(new_id)
        }
        Err(e) => Err(format!("Ошибка вставки: {}", e)),
    }
}

// 2. Получить все заметки
#[tauri::command]
async fn get_notes(state: State<'_, AppState>) -> Result<Vec<Note>, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    let db = client.database("knowledge_base");
    let collection = db.collection::<Note>("notes");

    // ИСПРАВЛЕНИЕ 2: Используем doc! {} вместо None для фильтра "все"
    // и убрали второй None (options)
    let mut cursor = collection.find(doc! {}).await.map_err(|e| e.to_string())?;

    let mut notes: Vec<Note> = Vec::new();
    while let Some(note) = cursor.try_next().await.map_err(|e| e.to_string())? {
        notes.push(note);
    }

    Ok(notes)
}

// 3. Проверка связи
#[tauri::command]
async fn check_db_connection(state: State<'_, AppState>) -> Result<String, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    match client.list_database_names().await {
        Ok(dbs) => Ok(format!("Базы данных: {:?}", dbs)),
        Err(e) => Err(e.to_string()),
    }
}

// --- ИНИЦИАЛИЗАЦИЯ ---

async fn init_mongo() -> Option<Client> {
    let client_options = ClientOptions::parse("mongodb://localhost:27017").await;
    match client_options {
        Ok(options) => Client::with_options(options).ok(),
        Err(_) => None,
    }
}

// 4. Удалить заметку
#[tauri::command]
async fn delete_note(state: State<'_, AppState>, id: String) -> Result<String, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    let db = client.database("knowledge_base");
    let collection = db.collection::<Note>("notes");

    // Превращаем строку ID обратно в ObjectId
    let object_id = ObjectId::parse_str(&id).map_err(|_| "Неверный формат ID")?;

    // Удаляем документ по _id
    let result = collection
        .delete_one(doc! { "_id": object_id })
        .await
        .map_err(|e| e.to_string())?;

    if result.deleted_count == 1 {
        Ok("Удалено".to_string())
    } else {
        Err("Заметка не найдена".to_string())
    }
}

// 5. Поиск заметок
#[tauri::command]
async fn search_notes(state: State<'_, AppState>, query: String) -> Result<Vec<Note>, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    let db = client.database("knowledge_base");
    let collection = db.collection::<Note>("notes");

    // 1. Формируем фильтр: ищем текст
    let filter = doc! { "$text": { "$search": query } };

    // 2. Настройка сортировки: самые релевантные (лучшие совпадения) вверх
    let sort = doc! { "score": { "$meta": "textScore" } };

    // 3. Выполняем запрос с сортировкой
    let find_options = mongodb::options::FindOptions::builder().sort(sort).build();

    let mut cursor = collection
        .find(filter)
        .with_options(find_options)
        .await
        .map_err(|e| e.to_string())?;

    let mut notes: Vec<Note> = Vec::new();
    while let Some(note) = cursor.try_next().await.map_err(|e| e.to_string())? {
        notes.push(note);
    }

    Ok(notes)
}

// 6. Обновить заметку
#[tauri::command]
async fn update_note(
    state: State<'_, AppState>,
    id: String,
    title: String,
    content: String,
    tags: Vec<String>,
) -> Result<String, String> {
    let client = {
        let guard = state.db.lock().unwrap();
        guard.clone()
    }
    .ok_or("БД не подключена")?;

    let db = client.database("knowledge_base");
    let collection = db.collection::<Note>("notes");

    let object_id = ObjectId::parse_str(&id).map_err(|_| "Неверный ID")?;

    // Формируем обновление: меняем title, content и tags
    let update = doc! {
        "$set": {
            "title": title,
            "content": content,
            "tags": tags
        }
    };

    let result = collection
        .update_one(doc! { "_id": object_id }, update)
        .await
        .map_err(|e| e.to_string())?;

    if result.matched_count == 1 {
        Ok("Обновлено успешно".to_string())
    } else {
        Err("Заметка не найдена".to_string())
    }
}

#[tokio::main]
async fn main() {
    let mongo_client = init_mongo().await;
    if mongo_client.is_some() {
        println!("✅ Подключение к MongoDB успешно!");
    } else {
        println!("❌ Ошибка подключения к MongoDB");
    }

    tauri::Builder::default()
        .manage(AppState {
            db: Mutex::new(mongo_client),
        })
        .invoke_handler(tauri::generate_handler![
            check_db_connection,
            create_note,
            get_notes,
            delete_note,
            search_notes,
            update_note,
        ])
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
