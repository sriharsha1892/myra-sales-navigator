"use client";

import { useState } from "react";
import { useStore } from "@/lib/store";

interface CompanyNotesProps {
  companyDomain: string;
}

export function CompanyNotes({ companyDomain }: CompanyNotesProps) {
  const companyNotes = useStore((s) => s.companyNotes);
  const addNote = useStore((s) => s.addNote);
  const editNote = useStore((s) => s.editNote);
  const deleteNote = useStore((s) => s.deleteNote);
  const userName = useStore((s) => s.userName);
  const addToast = useStore((s) => s.addToast);
  const [content, setContent] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editContent, setEditContent] = useState("");

  const notes = companyNotes(companyDomain);

  const handleSubmit = () => {
    if (!content.trim()) return;
    const mentions = parseMentions(content);
    addNote(companyDomain, content.trim(), mentions);
    setContent("");
    addToast({ message: "Note added", type: "success" });
  };

  const handleEdit = (noteId: string) => {
    if (!editContent.trim()) return;
    const mentions = parseMentions(editContent);
    editNote(noteId, companyDomain, editContent.trim(), mentions);
    setEditingId(null);
    setEditContent("");
    addToast({ message: "Note updated", type: "success" });
  };

  const addUndoToast = useStore((s) => s.addUndoToast);

  const handleDelete = (noteId: string) => {
    const note = notes.find((n) => n.id === noteId);
    deleteNote(noteId, companyDomain);
    addUndoToast("Note deleted", () => {
      if (note) {
        addNote(companyDomain, note.content, note.mentions);
      }
    });
  };

  return (
    <div className="px-4 py-3">
      <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-text-tertiary">
        Notes
      </h3>

      {/* Existing notes */}
      {notes.length > 0 && (
        <div className="mb-3 space-y-2">
          {notes.map((note) => {
            const isAuthor = note.authorName === userName;
            const isEditing = editingId === note.id;

            return (
              <div
                key={note.id}
                className="rounded-card border border-surface-3 bg-surface-0 p-2.5"
              >
                {isEditing ? (
                  <div className="space-y-1.5">
                    <textarea
                      value={editContent}
                      onChange={(e) => setEditContent(e.target.value)}
                      rows={2}
                      className="w-full resize-none rounded-input border border-surface-3 bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
                    />
                    <div className="flex gap-1">
                      <button
                        onClick={() => handleEdit(note.id)}
                        disabled={!editContent.trim()}
                        className="rounded-input bg-accent-primary px-2 py-0.5 text-[10px] font-medium text-text-inverse disabled:opacity-40"
                      >
                        Save
                      </button>
                      <button
                        onClick={() => { setEditingId(null); setEditContent(""); }}
                        className="rounded-input px-2 py-0.5 text-[10px] text-text-tertiary hover:text-text-secondary"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-xs text-text-primary">{note.content}</p>
                    <div className="mt-1 flex items-center gap-2 font-mono text-[10px] text-text-tertiary">
                      <span>{note.authorName}</span>
                      <span>&middot;</span>
                      <span>{new Date(note.createdAt).toLocaleDateString()}</span>
                      {note.updatedAt && (
                        <span className="italic">(edited)</span>
                      )}
                      {isAuthor && (
                        <>
                          <button
                            onClick={() => {
                              setEditingId(note.id);
                              setEditContent(note.content);
                            }}
                            className="ml-auto text-text-tertiary hover:text-accent-primary"
                          >
                            Edit
                          </button>
                          <button
                            onClick={() => handleDelete(note.id)}
                            className="text-text-tertiary hover:text-danger"
                          >
                            Delete
                          </button>
                        </>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Add note */}
      <div className="space-y-1.5">
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="Add a note... (use @name to mention)"
          rows={2}
          className="w-full resize-none rounded-input border border-surface-3 bg-surface-2 px-2.5 py-1.5 text-xs text-text-primary placeholder:text-text-tertiary focus:border-accent-primary focus:outline-none"
        />
        <button
          onClick={handleSubmit}
          disabled={!content.trim()}
          className="rounded-input bg-surface-2 px-3 py-1 text-xs font-medium text-text-secondary transition-colors hover:bg-surface-3 disabled:cursor-not-allowed disabled:opacity-40"
        >
          Add Note
        </button>
      </div>
    </div>
  );
}

/** Extract @mentions from note content */
function parseMentions(text: string): string[] {
  const matches = text.match(/@(\w+(?:\s+\w+)?)/g);
  if (!matches) return [];
  return matches.map((m) => m.slice(1));
}
