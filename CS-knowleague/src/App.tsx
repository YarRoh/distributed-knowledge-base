import { useState, useEffect, useRef } from "react";
// Если версия Tauri старая, используй '@tauri-apps/api/tauri'
import { invoke } from "@tauri-apps/api/core";
import "./App.css";

import ReactMarkdown from "react-markdown";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";

interface Note {
  _id: { $oid: string };
  title: string;
  content: string;
  tags: string[];
}

function App() {
  const [notes, setNotes] = useState<Note[]>([]);

  // Состояния формы
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [tags, setTags] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState("");

  // Ссылка на textarea для вставки текста в позицию курсора
  const textAreaRef = useRef<HTMLTextAreaElement>(null);

  useEffect(() => {
    if (searchQuery.trim() === "") fetchNotes();
    else handleSearch();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchQuery]);

  async function fetchNotes() {
    try {
      const result = await invoke<Note[]>("get_notes");
      setNotes(result.reverse());
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSearch() {
    try {
      const result = await invoke<Note[]>("search_notes", {
        query: searchQuery,
      });
      setNotes(result);
    } catch (e) {
      console.error(e);
    }
  }

  async function handleSave() {
    if (!title) return; // Content может быть пустым (если только картинка)
    const tagsArray = tags
      .split(",")
      .map((t) => t.trim())
      .filter((t) => t.length > 0);

    try {
      if (editingId) {
        await invoke("update_note", {
          id: editingId,
          title,
          content,
          tags: tagsArray,
        });
      } else {
        await invoke("create_note", { title, content, tags: tagsArray });
      }
      resetForm();
      if (searchQuery) handleSearch();
      else fetchNotes();
    } catch (e) {
      alert("Ошибка: " + e);
    }
  }

  function startEdit(note: Note) {
    setEditingId(note._id.$oid);
    setTitle(note.title);
    setContent(note.content);
    setTags(note.tags.join(", "));
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function resetForm() {
    setTitle("");
    setContent("");
    setTags("");
    setEditingId(null);
  }

  async function handleDelete(id: string) {
    if (!confirm("Удалить заметку?")) return;
    try {
      await invoke("delete_note", { id });
      if (editingId === id) resetForm();
      if (searchQuery) handleSearch();
      else fetchNotes();
    } catch (e) {
      alert("Ошибка удаления");
    }
  }

  // --- ЛОГИКА КАРТИНОК ---

  // 1. Функция вставки текста в позицию курсора
  const insertTextAtCursor = (textToInsert: string) => {
    if (!textAreaRef.current) return;

    const textarea = textAreaRef.current;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const previousContent = content; // берем из state

    const newContent =
      previousContent.substring(0, start) +
      textToInsert +
      previousContent.substring(end);

    setContent(newContent);

    // Возвращаем фокус (опционально)
    setTimeout(() => {
      textarea.focus();
      textarea.selectionStart = textarea.selectionEnd =
        start + textToInsert.length;
    }, 0);
  };

  // 2. Обработка файла: Сжатие и конвертация в Base64
  const processImageFile = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const img = new Image();
      img.onload = () => {
        // Создаем Canvas для сжатия
        const canvas = document.createElement("canvas");

        // Ограничиваем ширину (чтобы база не лопнула)
        const MAX_WIDTH = 800;
        let width = img.width;
        let height = img.height;

        if (width > MAX_WIDTH) {
          height *= MAX_WIDTH / width;
          width = MAX_WIDTH;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext("2d");
        ctx?.drawImage(img, 0, 0, width, height);

        // Конвертируем в JPEG с качеством 0.7 (хорошее сжатие)
        const dataUrl = canvas.toDataURL("image/jpeg", 0.7);

        // Вставляем Markdown код картинки
        insertTextAtCursor(`\n![Image](${dataUrl})\n`);
      };
      if (e.target?.result) {
        img.src = e.target.result as string;
      }
    };
    reader.readAsDataURL(file);
  };

  // 3. Обработчик Ctrl+V (Paste)
  const handlePaste = (e: React.ClipboardEvent) => {
    const items = e.clipboardData.items;
    for (const item of items) {
      if (item.type.indexOf("image") === 0) {
        e.preventDefault(); // Отменяем стандартную вставку (чтобы не дублировать)
        const file = item.getAsFile();
        if (file) processImageFile(file);
        return; // Обрабатываем только первую картинку
      }
    }
  };

  // 4. Обработчик Drag & Drop
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    const files = e.dataTransfer.files;
    if (files && files.length > 0) {
      const file = files[0];
      if (file.type.startsWith("image/")) {
        processImageFile(file);
      }
    }
  };

  return (
    <div className="container">
      <h1>CS Knowledge Base 🧠</h1>

      <div className="search-bar" style={{ marginBottom: "20px" }}>
        <input
          type="text"
          placeholder="🔍 Поиск (название, текст, теги)..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          style={{ width: "100%", padding: "15px", fontSize: "1.1rem" }}
        />
      </div>

      {(!searchQuery || editingId) && (
        <div
          className={`editor ${editingId ? "edit-mode" : ""}`}
          // Добавляем обработчик Drop на весь редактор
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleDrop}
        >
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
            }}
          >
            <h3 style={{ marginTop: 0, color: editingId ? "#f9cb28" : "#aaa" }}>
              {editingId ? "✏️ Редактирование" : "📝 Новая заметка"}
            </h3>
            {editingId && (
              <button
                onClick={resetForm}
                style={{ background: "transparent", color: "#888" }}
              >
                Отмена
              </button>
            )}
          </div>

          <input
            placeholder="Название темы..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />

          <textarea
            ref={textAreaRef} // Привязываем Ref
            placeholder="Пиши Markdown или вставляй картинки (Ctrl+V / Drag&Drop)..."
            rows={8}
            value={content}
            onChange={(e) => setContent(e.target.value)}
            // Добавляем обработчик Paste
            onPaste={handlePaste}
            style={{ minHeight: "150px" }}
          />

          <input
            placeholder="Теги..."
            value={tags}
            onChange={(e) => setTags(e.target.value)}
          />

          <button className="btn-save" onClick={handleSave}>
            {editingId ? "💾 Обновить" : "🚀 Сохранить"}
          </button>
        </div>
      )}

      <div className="notes-list">
        <h2>{searchQuery ? `Результаты: "${searchQuery}"` : "Все заметки"}</h2>
        {notes.length === 0 && <p style={{ opacity: 0.5 }}>Нет записей...</p>}

        {notes.map((note) => (
          <div key={note._id.$oid} className="note-card">
            <div className="note-header">
              <h3>{note.title}</h3>
              <div className="actions">
                <button
                  className="btn-edit"
                  onClick={() => startEdit(note)}
                  title="Редактировать"
                >
                  ✎
                </button>
                <button
                  className="btn-delete"
                  onClick={() => handleDelete(note._id.$oid)}
                  title="Удалить"
                >
                  ✕
                </button>
              </div>
            </div>

            <div className="note-content markdown-body">
              <ReactMarkdown
                urlTransform={(value) => value}
                components={{
                  code(props) {
                    const { children, className, node, ...rest } = props;
                    const match = /language-(\w+)/.exec(className || "");
                    return match ? (
                      <SyntaxHighlighter
                        {...(rest as any)}
                        PreTag="div"
                        children={String(children).replace(/\n$/, "")}
                        language={match[1]}
                        style={vscDarkPlus}
                      />
                    ) : (
                      <code {...rest} className={className}>
                        {children}
                      </code>
                    );
                  },
                  // Добавляем стиль для картинок, чтобы они не вылезали
                  img(props) {
                    return (
                      <img
                        {...props}
                        style={{
                          maxWidth: "100%",
                          borderRadius: "8px",
                          border: "1px solid #444",
                        }}
                      />
                    );
                  },
                }}
              >
                {note.content}
              </ReactMarkdown>
            </div>

            <div className="note-footer">
              <div className="tags">
                {note.tags.map((tag, idx) => (
                  <span key={idx} className="tag">
                    #{tag}
                  </span>
                ))}
              </div>
              <span className="id-badge">ID: {note._id.$oid}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

export default App;
