import React, { useEffect, useMemo, useRef, useState } from 'react';
import styled from 'styled-components';
import { useParams, Link, useNavigate } from 'react-router-dom';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import { getBookById, Book } from '../services/api';
import {
  loadBookDirHandle,
  pickDirectory,
  readBookBundle,
  readOutlineBundle,
  saveBookDirHandle,
  writeBookBundle,
  writeOutlineBundle,
  SyncPage,
  OutlineBundle,
  OutlinePart,
  OutlineEvent,
  OutlineStatus,
  OutlineChapter,
  PlanningTask,
  PlanningTaskComment,
  normalizeOutlineBundle,
} from '../utils/fsAccess';

type Page = SyncPage;
type ChapterUsageContext = {
  partId: string;
  partTitle: string;
  eventId: string;
  eventTitle: string;
};

const defaultOutline = (): OutlineBundle => ({
  version: 2,
  chapters: [],
  parts: [],
  tasks: [],
});

const defaultPages = (): Page[] => [
  { id: 'p1', title: 'Page 1', content: '', linkedChapterIds: [] },
  { id: 'p2', title: 'Page 2', content: '', linkedChapterIds: [] },
];

const normalizePages = (rawPages: unknown): Page[] => {
  if (!Array.isArray(rawPages)) {
    return defaultPages();
  }

  const normalizedPages = rawPages.map((page, index) => ({
    id: typeof (page as any)?.id === 'string' && (page as any).id ? (page as any).id : `p${index + 1}`,
    title:
      typeof (page as any)?.title === 'string' && (page as any).title.trim()
        ? (page as any).title.trim()
        : `Page ${index + 1}`,
    content: typeof (page as any)?.content === 'string' ? (page as any).content : '',
    linkedChapterIds: Array.isArray((page as any)?.linkedChapterIds)
      ? (page as any).linkedChapterIds.filter((chapterId: unknown) => typeof chapterId === 'string')
      : [],
  }));

  return normalizedPages.length > 0 ? normalizedPages : defaultPages();
};

const createId = (prefix: string): string =>
  `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const dayLabelFormatter = new Intl.DateTimeFormat('en-US', { weekday: 'short' });
const shortMonthFormatter = new Intl.DateTimeFormat('en-US', { month: 'short' });
const monthLabelFormatter = new Intl.DateTimeFormat('en-US', { month: 'long', year: 'numeric' });
const fullDateFormatter = new Intl.DateTimeFormat('en-US', {
  month: 'long',
  day: 'numeric',
  year: 'numeric',
});

const formatDateInputValue = (date: Date): string => {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  const day = `${date.getDate()}`.padStart(2, '0');
  return `${year}-${month}-${day}`;
};

const parseDateInputValue = (value: string): Date => {
  const [year, month, day] = value.split('-').map(Number);
  return new Date(year, (month || 1) - 1, day || 1);
};

const getMonthStart = (date: Date): Date => new Date(date.getFullYear(), date.getMonth(), 1);

const addDays = (date: Date, amount: number): Date => {
  const nextDate = new Date(date);
  nextDate.setDate(nextDate.getDate() + amount);
  return nextDate;
};

const buildCalendarDays = (displayMonth: Date): Date[] => {
  const firstDay = getMonthStart(displayMonth);
  const gridStart = addDays(firstDay, -firstDay.getDay());
  return Array.from({ length: 42 }, (_, index) => addDays(gridStart, index));
};

const isSameMonth = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() && left.getMonth() === right.getMonth();

const isSameDay = (left: Date, right: Date): boolean =>
  left.getFullYear() === right.getFullYear() &&
  left.getMonth() === right.getMonth() &&
  left.getDate() === right.getDate();

const statusOrder: Record<OutlineStatus, number> = {
  'in-progress': 0,
  todo: 1,
  blocked: 2,
  done: 3,
};

const statusLabel: Record<OutlineStatus, string> = {
  todo: 'To do',
  'in-progress': 'In progress',
  blocked: 'Blocked',
  done: 'Done',
};

const comparePlanningTasks = (left: PlanningTask, right: PlanningTask): number => {
  const statusDelta = statusOrder[left.status] - statusOrder[right.status];

  if (statusDelta !== 0) {
    return statusDelta;
  }

  const dateDelta = left.date.localeCompare(right.date);

  if (dateDelta !== 0) {
    return dateDelta;
  }

  return left.title.localeCompare(right.title);
};

const intersects = (left: string[], right: string[]): boolean =>
  left.some((value) => right.includes(value));

const isPartDone = (part: OutlinePart): boolean =>
  part.events.length > 0 && part.events.every((event) => event.status === 'done');

const getPartStatus = (part: OutlinePart): OutlineStatus => {
  if (isPartDone(part)) {
    return 'done';
  }

  if (part.status === 'done') {
    return 'in-progress';
  }

  return part.status;
};

const Layout = styled.div`
  min-height: 100vh;
  padding: 40px 24px 72px;
  background:
    radial-gradient(circle at top left, rgba(182, 201, 190, 0.24), transparent 30%),
    radial-gradient(circle at bottom right, rgba(214, 205, 188, 0.28), transparent 28%),
    linear-gradient(180deg, #f5f1ea 0%, #f1eee7 100%);
  color: #1f2933;

  .page-shell {
    max-width: 1360px;
    margin: 0 auto;
    display: grid;
    grid-template-columns: 272px minmax(0, 1fr);
    gap: 20px;
    align-items: start;
  }

  .page-shell.planning-mode {
    max-width: 1540px;
    grid-template-columns: 240px minmax(0, 1fr);
    gap: 18px;
  }

  .workspace-sidebar,
  .workspace-header,
  .panel {
    background: rgba(255, 255, 255, 0.72);
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-radius: 28px;
    backdrop-filter: blur(12px);
    box-shadow: 0 16px 50px rgba(31, 41, 51, 0.08);
  }

  .workspace-sidebar {
    padding: 28px;
    color: #1f2933;
    display: flex;
    flex-direction: column;
    gap: 18px;
    position: sticky;
    top: 24px;
  }

  .page-shell.planning-mode .workspace-sidebar {
    padding: 22px;
    gap: 14px;
  }

  .brand {
    display: inline-flex;
    align-items: center;
    width: fit-content;
    padding: 7px 12px;
    border-radius: 999px;
    background: rgba(31, 41, 51, 0.06);
    color: #52606d;
    font-size: 12px;
    font-weight: 700;
    letter-spacing: 0.12em;
    text-transform: uppercase;
    margin-bottom: 4px;
  }

  .book-meta {
    padding: 18px;
    border-radius: 22px;
    background: rgba(255, 255, 255, 0.78);
    border: 1px solid rgba(31, 41, 51, 0.08);
  }

  .book-meta-title {
    margin: 0 0 4px;
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-size: 1.5rem;
    line-height: 1.05;
    color: #18212b;
  }

  .book-meta-author {
    color: #616e7c;
    font-size: 0.95rem;
  }

  .nav {
    display: grid;
    gap: 10px;
  }

  .nav button {
    min-height: 48px;
    padding: 0 16px;
    border-radius: 999px;
    text-align: left;
    background: rgba(255, 255, 255, 0.8);
    color: #3e4c59;
    border: 1px solid rgba(31, 41, 51, 0.08);
    font-weight: 600;
  }

  .nav button.active {
    background: #18212b;
    color: #ffffff;
    border-color: #18212b;
    box-shadow: 0 10px 24px rgba(24, 33, 43, 0.18);
  }

  .nav button:not(.active):hover {
    background: rgba(24, 33, 43, 0.04);
    border-color: rgba(24, 33, 43, 0.14);
    color: #18212b;
    transform: translateY(-1px);
  }

  .nav button.active:hover {
    background: #0f1720;
    transform: translateY(-1px);
  }

  .content {
    padding: 0;
    display: grid;
    gap: 18px;
  }

  .workspace-header {
    padding: 24px 28px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 18px;
  }

  .header-copy {
    min-width: 0;
  }

  .back {
    display: inline-block;
    margin-bottom: 10px;
    color: #7b8794;
    font-size: 0.95rem;
  }

  .book-title {
    margin: 0;
    font-family: 'Iowan Old Style', 'Palatino Linotype', 'Book Antiqua', Georgia, serif;
    font-size: clamp(2rem, 4vw, 3.2rem);
    line-height: 0.98;
    letter-spacing: -0.04em;
    color: #18212b;
  }

  .workspace-subtitle {
    margin-top: 8px;
    color: #616e7c;
    font-size: 1rem;
  }

  .actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: flex-end;
    align-items: center;
    gap: 10px;
  }

  .status {
    padding: 8px 12px;
    border-radius: 999px;
    background: rgba(31, 41, 51, 0.06);
    color: #52606d;
    font-size: 0.9rem;
  }

  .primary-action,
  .secondary-action,
  .ghost-action {
    min-height: 48px;
    padding: 0 18px;
    border-radius: 999px;
    font-weight: 700;
    letter-spacing: -0.01em;
  }

  .primary-action {
    background: #18212b;
    color: #ffffff;
    box-shadow: 0 10px 24px rgba(24, 33, 43, 0.18);
  }

  .primary-action:hover {
    background: #0f1720;
    transform: translateY(-1px);
  }

  .secondary-action {
    background: transparent;
    color: #18212b;
    border: 1px solid rgba(24, 33, 43, 0.14);
  }

  .secondary-action:hover {
    background: rgba(24, 33, 43, 0.04);
  }

  .ghost-action {
    min-height: 42px;
    padding: 0 14px;
    background: rgba(24, 33, 43, 0.05);
    color: #18212b;
    border: 1px solid rgba(24, 33, 43, 0.12);
    font-weight: 600;
  }

  .ghost-action:hover {
    background: rgba(24, 33, 43, 0.08);
  }

  .panel {
    padding: 24px;
  }

  .page-list {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    margin-bottom: 18px;
    align-items: center;
  }

  .page-pill {
    min-width: 108px;
    min-height: 64px;
    padding: 12px 16px;
    border-radius: 24px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.78);
    color: #3e4c59;
    font-weight: 600;
    display: inline-flex;
    flex-direction: column;
    align-items: flex-start;
    justify-content: center;
    gap: 6px;
  }

  .page-pill:hover {
    background: rgba(255, 255, 255, 0.96);
    border-color: rgba(24, 33, 43, 0.14);
    transform: translateY(-1px);
    box-shadow: 0 10px 20px rgba(31, 41, 51, 0.08);
  }

  .page-pill.active {
    background: rgba(248, 244, 236, 0.94);
    border-color: rgba(93, 70, 48, 0.22);
    color: #5d4630;
    box-shadow: inset 0 0 0 1px rgba(93, 70, 48, 0.08);
  }

  .page-pill.active:hover {
    background: rgba(248, 244, 236, 0.98);
    border-color: rgba(93, 70, 48, 0.24);
    color: #5d4630;
  }

  .page-pill-title {
    font-size: 0.92rem;
    line-height: 1.1;
  }

  .page-pill-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
  }

  .page-pill-tag {
    display: inline-flex;
    align-items: center;
    min-height: 20px;
    max-width: 100%;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-size: 0.72rem;
    font-weight: 700;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .page-link-panel {
    margin-bottom: 18px;
    display: grid;
    gap: 8px;
  }

  .page-link-label {
    color: #52606d;
    font-size: 0.82rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .page-link-dropdown {
    position: relative;
  }

  .page-link-dropdown[open] .page-link-trigger {
    border-color: rgba(24, 33, 43, 0.16);
    box-shadow: 0 12px 28px rgba(31, 41, 51, 0.08);
  }

  .page-link-trigger {
    list-style: none;
    display: grid;
    grid-template-columns: minmax(0, 1fr) auto;
    gap: 12px;
    align-items: center;
    padding: 12px 14px;
    border-radius: 18px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.82);
    cursor: pointer;
  }

  .page-link-trigger::-webkit-details-marker {
    display: none;
  }

  .page-link-trigger-copy {
    display: grid;
    gap: 4px;
    min-width: 0;
  }

  .page-link-trigger-title {
    color: #18212b;
    font-size: 0.96rem;
    font-weight: 700;
  }

  .page-link-trigger-subtitle,
  .page-link-empty,
  .page-link-empty-context {
    color: #616e7c;
    font-size: 0.84rem;
  }

  .page-link-trigger-meta {
    display: flex;
    align-items: center;
    justify-content: flex-end;
    flex-wrap: wrap;
    gap: 6px;
    min-width: 0;
  }

  .page-link-caret {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 26px;
    height: 26px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-weight: 700;
  }

  .page-link-menu {
    margin-top: 8px;
    padding: 10px;
    border-radius: 18px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.94);
    box-shadow: 0 18px 40px rgba(31, 41, 51, 0.08);
    display: grid;
    gap: 6px;
  }

  .page-link-options {
    display: grid;
    gap: 6px;
  }

  .page-link-option {
    display: grid;
    grid-template-columns: auto minmax(0, 1fr);
    gap: 10px;
    align-items: start;
    padding: 8px 10px;
    border-radius: 14px;
    border: 1px solid rgba(31, 41, 51, 0.06);
    background: rgba(248, 248, 247, 0.86);
  }

  .page-link-option.is-linked {
    border-color: rgba(24, 33, 43, 0.14);
    background: rgba(248, 244, 236, 0.84);
  }

  .page-link-option input {
    margin-top: 3px;
    width: 16px;
    height: 16px;
  }

  .page-link-copy {
    display: grid;
    gap: 5px;
    min-width: 0;
  }

  .page-link-title {
    color: #18212b;
    font-weight: 700;
    font-size: 0.9rem;
  }

  .page-link-contexts,
  .page-linked-chapters {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
  }

  .page-meta-tag,
  .page-linked-chapter-tag,
  .page-link-trigger-tag,
  .page-link-trigger-count {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-size: 0.76rem;
    font-weight: 600;
  }

  .page-meta-tag.part-tag {
    background: rgba(93, 70, 48, 0.12);
    color: #5d4630;
  }

  .page-linked-chapters {
    margin-top: 2px;
  }

  .editor {
    min-height: 520px;
  }

  .editor .ql-toolbar {
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-radius: 18px 18px 0 0;
    background: rgba(250, 248, 244, 0.92);
  }

  .editor .ql-container {
    border: 1px solid rgba(31, 41, 51, 0.08);
    border-top: 0;
    border-radius: 0 0 22px 22px;
    background: rgba(255, 255, 255, 0.92);
    min-height: 460px;
    font-size: 1rem;
    color: #1f2933;
  }

  .editor .ql-editor {
    min-height: 460px;
    padding: 24px 24px 32px;
    line-height: 1.8;
  }

  .editor .ql-editor.ql-blank::before {
    color: #8a94a0;
    font-style: normal;
  }

  .outline-panel {
    display: grid;
    gap: 20px;
  }

  .outline-summary {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 14px;
  }

  .summary-card {
    padding: 18px;
    border-radius: 22px;
    background: rgba(248, 244, 236, 0.9);
    border: 1px solid rgba(93, 70, 48, 0.12);
    display: grid;
    gap: 6px;
  }

  .summary-card span {
    font-size: 0.85rem;
    color: #7b8794;
    text-transform: uppercase;
    letter-spacing: 0.08em;
  }

  .summary-card strong {
    font-size: 1.9rem;
    color: #18212b;
  }

  .outline-toolbar {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }

  .chapter-library {
    display: flex;
    flex-wrap: wrap;
    gap: 10px;
  }

  .chapter-chip {
    display: inline-flex;
    align-items: center;
    min-height: 38px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(255, 255, 255, 0.86);
    border: 1px solid rgba(24, 33, 43, 0.12);
    color: #18212b;
    font-weight: 600;
  }

  .chapter-library-empty {
    color: #7b8794;
  }

  .outline-parts {
    display: grid;
    gap: 18px;
  }

  .outline-part-card {
    padding: 22px;
    border-radius: 24px;
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.82);
    display: grid;
    gap: 16px;
  }

  .outline-part-header {
    display: grid;
    grid-template-columns: minmax(0, 1.4fr) 180px auto auto;
    gap: 12px;
    align-items: center;
  }

  .outline-field,
  .outline-textarea,
  .outline-select {
    width: 100%;
    border-radius: 16px;
    border: 1px solid rgba(31, 41, 51, 0.12);
    background: rgba(255, 255, 255, 0.96);
    color: #18212b;
    font-size: 0.98rem;
    padding: 12px 14px;
  }

  .outline-textarea {
    min-height: 96px;
    resize: vertical;
  }

  .outline-events {
    display: grid;
    gap: 12px;
  }

  .outline-event-row {
    display: grid;
    grid-template-columns: minmax(0, 1.3fr) 170px minmax(240px, 1fr) auto;
    gap: 12px;
    align-items: start;
    padding: 14px;
    border-radius: 18px;
    background: rgba(244, 247, 250, 0.9);
    border: 1px solid rgba(31, 41, 51, 0.08);
  }

  .outline-event-details {
    display: grid;
    gap: 10px;
  }

  .status-pill {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    min-height: 42px;
    padding: 0 14px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-weight: 700;
    text-transform: capitalize;
  }

  .outline-empty {
    padding: 28px;
    border-radius: 24px;
    border: 1px dashed rgba(31, 41, 51, 0.2);
    background: rgba(255, 255, 255, 0.5);
    color: #616e7c;
  }

  .chapter-picker {
    min-width: 0;
  }

  .chapter-dropdown {
    position: relative;
  }

  .chapter-dropdown[open] .chapter-trigger {
    border-color: rgba(24, 33, 43, 0.18);
    box-shadow: 0 10px 24px rgba(31, 41, 51, 0.08);
  }

  .chapter-trigger {
    list-style: none;
    display: grid;
    grid-template-columns: 1fr auto;
    gap: 12px;
    align-items: center;
    min-height: 52px;
    padding: 12px 14px;
    border-radius: 16px;
    border: 1px solid rgba(31, 41, 51, 0.12);
    background: rgba(255, 255, 255, 0.96);
    cursor: pointer;
  }

  .chapter-trigger::-webkit-details-marker {
    display: none;
  }

  .chapter-trigger-text {
    min-width: 0;
    color: #18212b;
    font-weight: 600;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .chapter-trigger-add {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    width: 28px;
    height: 28px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-size: 1.1rem;
    line-height: 1;
    font-weight: 700;
  }

  .chapter-menu {
    margin-top: 10px;
    padding: 14px;
    border-radius: 18px;
    border: 1px solid rgba(31, 41, 51, 0.12);
    background: rgba(255, 255, 255, 0.98);
    box-shadow: 0 18px 40px rgba(31, 41, 51, 0.08);
    display: grid;
    gap: 10px;
  }

  .chapter-option {
    display: grid;
    grid-template-columns: auto 1fr;
    gap: 10px;
    align-items: center;
    color: #18212b;
    font-weight: 600;
  }

  .chapter-option input {
    width: 18px;
    height: 18px;
  }

  .chapter-menu-empty {
    color: #7b8794;
  }

  .chapter-create {
    display: grid;
    gap: 10px;
  }

  .linked-chapter-list {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .linked-chapter-chip {
    display: inline-flex;
    align-items: center;
    min-height: 32px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-size: 0.9rem;
    font-weight: 600;
  }

  .linked-chapter-empty {
    color: #7b8794;
    font-size: 0.95rem;
  }

  .planned-task-panel,
  .planning-panel,
  .planning-calendar-card,
  .planning-inspector,
  .planned-task-card {
    display: grid;
    gap: 14px;
  }

  .planned-task-card,
  .planning-calendar-card,
  .planning-inspector,
  .planning-summary-card,
  .calendar-day {
    border: 1px solid rgba(31, 41, 51, 0.08);
    background: rgba(255, 255, 255, 0.82);
    box-shadow: 0 16px 36px rgba(31, 41, 51, 0.06);
  }

  .planned-task-card {
    padding: 18px;
    border-radius: 22px;
    background:
      linear-gradient(135deg, rgba(248, 244, 236, 0.92), rgba(255, 255, 255, 0.9)),
      rgba(255, 255, 255, 0.82);
  }

  .planned-task-card-header,
  .planning-toolbar,
  .planning-inspector-header,
  .planning-form-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    flex-wrap: wrap;
  }

  .planned-task-title,
  .planning-section-title,
  .planning-summary-value,
  .calendar-day-number {
    color: #18212b;
    font-weight: 700;
  }

  .planned-task-title {
    font-size: 1.08rem;
  }

  .planned-task-subtitle,
  .planned-task-empty,
  .planning-copy,
  .planning-summary-label,
  .planning-empty,
  .calendar-day-label,
  .task-block-meta,
  .comment-meta,
  .planning-link-empty,
  .planning-helper {
    color: #616e7c;
    font-size: 0.92rem;
  }

  .planned-task-description,
  .comment-body {
    color: #24313d;
    line-height: 1.6;
  }

  .planned-task-tags,
  .planned-task-queue,
  .planning-summary,
  .planning-link-list,
  .task-comment-list,
  .task-comment-composer,
  .planning-form,
  .planning-link-group,
  .calendar-day-tasks,
  .task-block-copy {
    display: grid;
    gap: 10px;
  }

  .planned-task-tag-list,
  .planning-link-options,
  .task-block-tags,
  .planning-weekdays {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .planned-task-tag,
  .task-block-tag,
  .planning-link-chip,
  .planning-count-pill,
  .task-status-badge,
  .queue-task-date {
    display: inline-flex;
    align-items: center;
    min-height: 24px;
    padding: 0 10px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #18212b;
    font-size: 0.78rem;
    font-weight: 700;
  }

  .planned-task-tag.kind-part,
  .task-block-tag.kind-part,
  .planning-link-chip.kind-part {
    background: rgba(93, 70, 48, 0.12);
    color: #5d4630;
  }

  .planned-task-tag.kind-event,
  .task-block-tag.kind-event,
  .planning-link-chip.kind-event {
    background: rgba(24, 95, 83, 0.12);
    color: #185f53;
  }

  .planned-task-tag.kind-chapter,
  .task-block-tag.kind-chapter,
  .planning-link-chip.kind-chapter {
    background: rgba(44, 62, 80, 0.1);
    color: #24313d;
  }

  .planned-task-queue-item,
  .task-comment-item {
    display: grid;
    gap: 6px;
    padding: 12px 14px;
    border-radius: 16px;
    background: rgba(255, 255, 255, 0.7);
    border: 1px solid rgba(31, 41, 51, 0.06);
  }

  .planned-task-queue-header,
  .comment-header {
    display: flex;
    justify-content: space-between;
    gap: 10px;
    align-items: center;
    flex-wrap: wrap;
  }

  .queue-task-title,
  .comment-title {
    color: #18212b;
    font-weight: 700;
  }

  .planning-panel {
    gap: 18px;
  }

  .planning-summary {
    grid-template-columns: repeat(auto-fit, minmax(160px, 1fr));
  }

  .planning-summary-card {
    padding: 18px;
    border-radius: 22px;
    background:
      radial-gradient(circle at top right, rgba(211, 197, 177, 0.24), transparent 45%),
      rgba(255, 255, 255, 0.84);
  }

  .planning-summary-label {
    text-transform: uppercase;
    letter-spacing: 0.08em;
    font-size: 0.78rem;
  }

  .planning-summary-value {
    font-size: 1.8rem;
  }

  .planning-layout {
    display: grid;
    gap: 18px;
    align-items: start;
  }

  .planning-calendar-card,
  .planning-inspector {
    padding: 20px;
    border-radius: 26px;
  }

  .planning-calendar-scroll {
    display: grid;
    gap: 12px;
    padding-bottom: 4px;
  }

  .planning-calendar-scroll {
    display: grid;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
  }

  .planning-month-controls {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }

  .planning-month-label {
    color: #18212b;
    font-weight: 700;
    min-width: 150px;
    text-align: center;
  }

  .planning-weekdays {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
    padding: 0 6px;
  }

  .planning-weekday {
    color: #7b8794;
    font-size: 0.78rem;
    font-weight: 700;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }

  .planning-calendar-grid {
    display: grid;
    grid-template-columns: repeat(7, minmax(0, 1fr));
    gap: 10px;
  }

  .calendar-day {
    min-height: 148px;
    padding: 10px;
    border-radius: 20px;
    display: grid;
    grid-template-rows: auto 1fr auto;
    gap: 8px;
    background:
      linear-gradient(180deg, rgba(255, 255, 255, 0.95), rgba(247, 244, 238, 0.88));
  }

  .calendar-day.is-outside-month {
    opacity: 0.54;
  }

  .calendar-day.is-selected {
    border-color: rgba(93, 70, 48, 0.22);
    box-shadow: 0 18px 38px rgba(93, 70, 48, 0.12);
  }

  .calendar-day.is-today {
    background:
      radial-gradient(circle at top left, rgba(214, 205, 188, 0.24), transparent 42%),
      linear-gradient(180deg, rgba(255, 255, 255, 0.98), rgba(248, 244, 236, 0.9));
  }

  .calendar-day-header {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 4px;
    padding: 0;
    background: transparent;
    border: 0;
    text-align: left;
  }

  .calendar-day-topline {
    width: 100%;
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 8px;
  }

  .calendar-day-number {
    font-size: 1rem;
  }

  .calendar-day-label {
    font-size: 0.84rem;
    line-height: 1.25;
  }

  .calendar-day-badge {
    display: inline-flex;
    align-items: center;
    min-height: 22px;
    padding: 0 8px;
    border-radius: 999px;
    background: rgba(24, 33, 43, 0.08);
    color: #52606d;
    font-size: 0.72rem;
    font-weight: 700;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }

  .calendar-day-tasks {
    align-content: start;
  }

  .task-block {
    width: 100%;
    padding: 8px;
    border-radius: 16px;
    border: 1px solid transparent;
    text-align: left;
    display: grid;
    gap: 8px;
    background: rgba(24, 33, 43, 0.06);
    color: #18212b;
  }

  .task-block.active {
    border-color: rgba(24, 33, 43, 0.18);
    box-shadow: 0 10px 22px rgba(24, 33, 43, 0.12);
  }

  .task-block.status-todo {
    background: rgba(93, 70, 48, 0.1);
  }

  .task-block.status-in-progress {
    background: rgba(24, 95, 83, 0.12);
  }

  .task-block.status-blocked {
    background: rgba(148, 62, 38, 0.12);
  }

  .task-block.status-done {
    background: rgba(72, 111, 92, 0.12);
  }

  .task-block-title {
    color: #18212b;
    font-size: 0.84rem;
    font-weight: 700;
    line-height: 1.3;
  }

  .task-block-meta {
    font-size: 0.78rem;
  }

  .calendar-add-task,
  .planning-link-option {
    min-height: 34px;
    border-radius: 14px;
    border: 1px dashed rgba(24, 33, 43, 0.16);
    background: rgba(255, 255, 255, 0.7);
    color: #18212b;
    font-weight: 700;
  }

  .planning-link-option {
    display: inline-flex;
    align-items: center;
    justify-content: flex-start;
    width: fit-content;
    max-width: 100%;
    padding: 12px 16px;
    text-align: left;
    box-shadow: 0 6px 18px rgba(24, 33, 43, 0.04);
  }

  .planning-link-option.is-linked {
    border-style: solid;
    border-color: rgba(24, 33, 43, 0.16);
    background: rgba(248, 244, 236, 0.92);
    box-shadow: 0 10px 24px rgba(93, 70, 48, 0.08);
  }

  .planning-link-option-copy {
    display: grid;
    gap: 6px;
    text-align: left;
  }

  .planning-link-option-title {
    color: #18212b;
    font-weight: 700;
    line-height: 1.1;
  }

  .planning-link-option-subtitle {
    color: #616e7c;
    font-size: 0.82rem;
    line-height: 1;
  }

  .planning-form {
    gap: 14px;
  }

  .planning-form-row {
    display: grid;
    grid-template-columns: minmax(0, 1fr) 170px;
    gap: 12px;
  }

  .planning-section {
    display: grid;
    gap: 10px;
  }

  .planning-link-list {
    gap: 12px;
  }

  .task-comment-list {
    max-height: 220px;
    overflow: auto;
    padding-right: 4px;
  }

  .task-comment-composer {
    gap: 8px;
  }

  .task-comment-composer textarea {
    min-height: 92px;
  }

  .task-status-badge.status-todo {
    background: rgba(93, 70, 48, 0.12);
    color: #5d4630;
  }

  .task-status-badge.status-in-progress {
    background: rgba(24, 95, 83, 0.12);
    color: #185f53;
  }

  .task-status-badge.status-blocked {
    background: rgba(148, 62, 38, 0.12);
    color: #943e26;
  }

  .task-status-badge.status-done {
    background: rgba(72, 111, 92, 0.12);
    color: #486f5c;
  }

  .planning-empty {
    padding: 18px;
    border-radius: 18px;
    background: rgba(248, 248, 247, 0.88);
    border: 1px dashed rgba(31, 41, 51, 0.14);
  }

  @media (max-width: 1040px) {
    .page-shell {
      grid-template-columns: 1fr;
    }

    .workspace-sidebar {
      position: static;
    }

    .workspace-header {
      flex-direction: column;
      align-items: flex-start;
    }

    .actions {
      justify-content: flex-start;
    }

    .outline-part-header,
    .outline-event-row {
      grid-template-columns: 1fr;
    }
  }

  @media (max-width: 640px) {
    padding: 24px 16px 48px;

    .workspace-sidebar,
    .workspace-header,
    .panel {
      border-radius: 22px;
      padding: 22px;
    }

    .actions {
      width: 100%;
    }

    .primary-action,
    .secondary-action {
      width: 100%;
    }

    .planning-form-row {
      grid-template-columns: 1fr;
    }

    .planning-weekdays {
      display: none;
    }
  }
`;

const BookWorkspace: React.FC = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const importInputRef = useRef<HTMLInputElement | null>(null);

  const [book, setBook] = useState<Book | null>(null);
  const [activeView, setActiveView] = useState<'editor' | 'outline' | 'planning' | 'settings'>('editor');
  const [saveMessage, setSaveMessage] = useState<string>('');
  const [pages, setPages] = useState<Page[]>([]);
  const [outline, setOutline] = useState<OutlineBundle>(defaultOutline());
  const [activePageId, setActivePageId] = useState('');
  const [isDirty, setIsDirty] = useState(false);
  const [chapterDraftByEventId, setChapterDraftByEventId] = useState<Record<string, string>>({});
  const [addingChapterEventId, setAddingChapterEventId] = useState<string | null>(null);
  const [displayMonth, setDisplayMonth] = useState<Date>(() => getMonthStart(new Date()));
  const [selectedPlanningDate, setSelectedPlanningDate] = useState<string>(() =>
    formatDateInputValue(new Date())
  );
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null);
  const [taskCommentDraft, setTaskCommentDraft] = useState('');

  const pagesStorageKey = `book:${id}:pages`;
  const outlineStorageKey = `book:${id}:outline`;

  useEffect(() => {
    if (!id) return;
    getBookById(id).then(setBook).catch(() => setBook(null));
  }, [id]);

  useEffect(() => {
    if (!id) return;

    let cancelled = false;

    const loadWorkspace = async () => {
      try {
        const dir = await loadBookDirHandle(id);

        if (dir) {
          const [bookBundle, outlineBundle] = await Promise.all([
            readBookBundle(dir),
            readOutlineBundle(dir),
          ]);

          if (!cancelled) {
            const nextPages = bookBundle.pages.length > 0 ? bookBundle.pages : defaultPages();
            const normalizedPages = normalizePages(nextPages);
            const normalizedOutline = normalizeOutlineBundle(outlineBundle);
            const hasOutlineData =
              normalizedOutline.parts.length > 0 ||
              normalizedOutline.chapters.length > 0 ||
              normalizedOutline.tasks.length > 0;
            const nextOutline = hasOutlineData ? normalizedOutline : defaultOutline();

            setPages(normalizedPages);
            setActivePageId(normalizedPages[0]?.id ?? '');
            setOutline(nextOutline);
            localStorage.setItem(pagesStorageKey, JSON.stringify(normalizedPages));
            localStorage.setItem(outlineStorageKey, JSON.stringify(nextOutline));
          }
          return;
        }
      } catch {
        // ignore and fall back
      }

      const rawPages = localStorage.getItem(pagesStorageKey);
      const rawOutline = localStorage.getItem(outlineStorageKey);

      const loadedPages: Page[] = rawPages ? normalizePages(JSON.parse(rawPages)) : defaultPages();
      const loadedOutline: OutlineBundle = rawOutline
        ? normalizeOutlineBundle(JSON.parse(rawOutline))
        : defaultOutline();

      if (!cancelled) {
        setPages(loadedPages);
        setActivePageId(loadedPages[0]?.id ?? '');
        setOutline(loadedOutline);
      }

      localStorage.setItem(pagesStorageKey, JSON.stringify(loadedPages));
      localStorage.setItem(outlineStorageKey, JSON.stringify(loadedOutline));
    };

    loadWorkspace();

    return () => {
      cancelled = true;
    };
  }, [id, pagesStorageKey, outlineStorageKey]);

  useEffect(() => {
    if (!id || !isDirty) return;

    const timer = window.setTimeout(() => {
      localStorage.setItem(pagesStorageKey, JSON.stringify(pages));
      localStorage.setItem(outlineStorageKey, JSON.stringify(outline));
      setIsDirty(false);
      setSaveMessage('Autosaved locally');
      window.setTimeout(() => setSaveMessage(''), 1500);
    }, 800);

    return () => window.clearTimeout(timer);
  }, [id, isDirty, outline, outlineStorageKey, pages, pagesStorageKey]);

  useEffect(() => {
    const onBeforeUnload = (event: BeforeUnloadEvent) => {
      if (!isDirty) return;
      event.preventDefault();
      event.returnValue = '';
    };

    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [isDirty]);

  const activePage = useMemo(
    () => pages.find((page) => page.id === activePageId) ?? pages[0],
    [pages, activePageId]
  );

  const chapterMap = useMemo(
    () => new Map(outline.chapters.map((chapter) => [chapter.id, chapter])),
    [outline.chapters]
  );

  const partMap = useMemo(
    () => new Map(outline.parts.map((part) => [part.id, part])),
    [outline.parts]
  );

  const outlineEvents = useMemo(
    () => outline.parts.flatMap((part) => part.events),
    [outline]
  );

  const eventContextMap = useMemo(() => {
    const nextMap = new Map<string, ChapterUsageContext>();

    outline.parts.forEach((part) => {
      part.events.forEach((event) => {
        nextMap.set(event.id, {
          partId: part.id,
          partTitle: part.title,
          eventId: event.id,
          eventTitle: event.title,
        });
      });
    });

    return nextMap;
  }, [outline.parts]);

  const chapterUsageMap = useMemo(() => {
    const nextMap = new Map<string, ChapterUsageContext[]>();

    outline.parts.forEach((part) => {
      part.events.forEach((event) => {
        event.linkedChapterIds.forEach((chapterId) => {
          const existingEntries = nextMap.get(chapterId) ?? [];
          existingEntries.push({
            partId: part.id,
            partTitle: part.title,
            eventId: event.id,
            eventTitle: event.title,
          });
          nextMap.set(chapterId, existingEntries);
        });
      });
    });

    return nextMap;
  }, [outline]);

  const completedEvents = useMemo(
    () => outlineEvents.filter((event) => event.status === 'done').length,
    [outlineEvents]
  );

  const completedParts = useMemo(
    () => outline.parts.filter((part) => getPartStatus(part) === 'done').length,
    [outline]
  );

  const tasksByDate = useMemo(() => {
    const nextMap = new Map<string, PlanningTask[]>();

    outline.tasks.forEach((task) => {
      const existingTasks = nextMap.get(task.date) ?? [];
      existingTasks.push(task);
      nextMap.set(task.date, existingTasks);
    });

    nextMap.forEach((taskList) => taskList.sort(comparePlanningTasks));

    return nextMap;
  }, [outline.tasks]);

  const calendarDays = useMemo(() => buildCalendarDays(displayMonth), [displayMonth]);

  const selectedTask = useMemo(
    () => outline.tasks.find((task) => task.id === selectedTaskId) ?? null,
    [outline.tasks, selectedTaskId]
  );

  const activePageContext = useMemo(() => {
    if (!activePage) {
      return { chapterIds: [], partIds: [], eventIds: [] };
    }

    const partIds = new Set<string>();
    const eventIds = new Set<string>();

    activePage.linkedChapterIds.forEach((chapterId) => {
      (chapterUsageMap.get(chapterId) ?? []).forEach((context) => {
        partIds.add(context.partId);
        eventIds.add(context.eventId);
      });
    });

    return {
      chapterIds: activePage.linkedChapterIds,
      partIds: Array.from(partIds),
      eventIds: Array.from(eventIds),
    };
  }, [activePage, chapterUsageMap]);

  const relevantPlanningTasks = useMemo(
    () =>
      [...outline.tasks]
        .filter(
          (task) =>
            intersects(task.linkedChapterIds, activePageContext.chapterIds) ||
            intersects(task.linkedPartIds, activePageContext.partIds) ||
            intersects(task.linkedEventIds, activePageContext.eventIds)
        )
        .sort(comparePlanningTasks),
    [outline.tasks, activePageContext]
  );

  const currentPlannedTask =
    relevantPlanningTasks.find((task) => task.status !== 'done') ?? relevantPlanningTasks[0] ?? null;

  const todayKey = formatDateInputValue(new Date());
  const tasksThisWeek = useMemo(() => {
    const today = parseDateInputValue(todayKey);
    const weekEnd = addDays(today, 6);

    return outline.tasks.filter((task) => {
      const taskDate = parseDateInputValue(task.date);
      return taskDate >= today && taskDate <= weekEnd;
    }).length;
  }, [outline.tasks, todayKey]);

  const inProgressTasks = useMemo(
    () => outline.tasks.filter((task) => task.status === 'in-progress').length,
    [outline.tasks]
  );

  const blockedTasks = useMemo(
    () => outline.tasks.filter((task) => task.status === 'blocked').length,
    [outline.tasks]
  );

  useEffect(() => {
    if (selectedTaskId && !outline.tasks.some((task) => task.id === selectedTaskId)) {
      setSelectedTaskId(null);
      setTaskCommentDraft('');
    }
  }, [outline.tasks, selectedTaskId]);

  useEffect(() => {
    if (!selectedTask) {
      return;
    }

    setSelectedPlanningDate(selectedTask.date);
    setDisplayMonth(getMonthStart(parseDateInputValue(selectedTask.date)));
  }, [selectedTask]);

  const persistWorkspaceLocal = (nextPages: Page[], nextOutline: OutlineBundle) => {
    setPages(nextPages);
    setOutline(nextOutline);
    localStorage.setItem(pagesStorageKey, JSON.stringify(nextPages));
    localStorage.setItem(outlineStorageKey, JSON.stringify(nextOutline));
  };

  const saveToFolder = async (nextPages: Page[], nextOutline: OutlineBundle) => {
    if (!id) return;

    let dir = await loadBookDirHandle(id);
    if (!dir) {
      dir = await pickDirectory();
      await saveBookDirHandle(id, dir);
    }

    await writeBookBundle(
      dir,
      {
        title: book?.title ?? 'Untitled Book',
        author: book?.author ?? 'Unknown Author',
      },
      nextPages
    );

    await writeOutlineBundle(dir, nextOutline);
  };

  const addPart = () => {
    setOutline((current) => ({
      ...current,
      parts: [
        ...current.parts,
        {
          id: createId('part'),
          title: `Part ${current.parts.length + 1}`,
          description: '',
          status: 'todo',
          events: [],
        },
      ],
    }));
    setIsDirty(true);
  };

  const updatePart = (partId: string, updates: Partial<OutlinePart>) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.map((part) =>
        part.id === partId ? { ...part, ...updates } : part
      ),
    }));
    setIsDirty(true);
  };

  const removePart = (partId: string) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.filter((part) => part.id !== partId),
    }));
    setIsDirty(true);
  };

  const addEvent = (partId: string) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.map((part) =>
        part.id === partId
          ? {
              ...part,
              events: [
                ...part.events,
                {
                  id: createId('event'),
                  title: `Event ${part.events.length + 1}`,
                  description: '',
                  status: 'todo',
                  linkedChapterIds: [],
                },
              ],
            }
          : part
      ),
    }));
    setIsDirty(true);
  };

  const updateEvent = (
    partId: string,
    eventId: string,
    updates: Partial<OutlineEvent>
  ) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.map((part) =>
        part.id === partId
          ? {
              ...part,
              events: part.events.map((event) =>
                event.id === eventId ? { ...event, ...updates } : event
              ),
            }
          : part
      ),
    }));
    setIsDirty(true);
  };

  const removeEvent = (partId: string, eventId: string) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.map((part) =>
        part.id === partId
          ? {
              ...part,
              events: part.events.filter((event) => event.id !== eventId),
            }
          : part
      ),
    }));
    setIsDirty(true);
  };

  const toggleEventChapter = (partId: string, eventId: string, chapterId: string) => {
    setOutline((current) => ({
      ...current,
      parts: current.parts.map((part) =>
        part.id === partId
          ? {
              ...part,
              events: part.events.map((event) => {
                if (event.id !== eventId) {
                  return event;
                }

                const linkedChapterIds = event.linkedChapterIds.includes(chapterId)
                  ? event.linkedChapterIds.filter((linkedId) => linkedId !== chapterId)
                  : [...event.linkedChapterIds, chapterId];

                return {
                  ...event,
                  linkedChapterIds,
                };
              }),
            }
          : part
      ),
    }));
    setIsDirty(true);
  };

  const updateChapterDraft = (eventId: string, value: string) => {
    setChapterDraftByEventId((current) => ({
      ...current,
      [eventId]: value,
    }));
  };

  const startAddingChapter = (eventId: string) => {
    setAddingChapterEventId(eventId);
  };

  const cancelAddingChapter = (eventId: string) => {
    setChapterDraftByEventId((current) => ({
      ...current,
      [eventId]: '',
    }));
    setAddingChapterEventId((current) => (current === eventId ? null : current));
  };

  const createChapterForEvent = (partId: string, eventId: string, rawTitle: string) => {
    const trimmedTitle = rawTitle.trim();

    if (!trimmedTitle) {
      return;
    }

    setOutline((current) => {
      const existingChapter = current.chapters.find(
        (chapter) => chapter.title.toLowerCase() === trimmedTitle.toLowerCase()
      );

      const nextChapter: OutlineChapter =
        existingChapter ?? {
          id: createId('chapter'),
          title: trimmedTitle,
        };

      return {
        ...current,
        chapters: existingChapter ? current.chapters : [...current.chapters, nextChapter],
        parts: current.parts.map((part) =>
          part.id === partId
            ? {
                ...part,
                events: part.events.map((event) =>
                  event.id === eventId && !event.linkedChapterIds.includes(nextChapter.id)
                    ? {
                        ...event,
                        linkedChapterIds: [...event.linkedChapterIds, nextChapter.id],
                      }
                    : event
                ),
              }
            : part
        ),
      };
    });

    setChapterDraftByEventId((current) => ({
      ...current,
      [eventId]: '',
    }));
    setAddingChapterEventId((current) => (current === eventId ? null : current));
    setIsDirty(true);
  };

  const togglePageChapter = (pageId: string, chapterId: string) => {
    setPages((current) =>
      current.map((page) => {
        if (page.id !== pageId) {
          return page;
        }

        const linkedChapterIds = page.linkedChapterIds.includes(chapterId)
          ? page.linkedChapterIds.filter((linkedId) => linkedId !== chapterId)
          : [...page.linkedChapterIds, chapterId];

        return {
          ...page,
          linkedChapterIds,
        };
      })
    );
    setIsDirty(true);
  };

  const updateActivePage = (content: string) => {
    const nextPages = pages.map((page) =>
      page.id === activePageId ? { ...page, content } : page
    );
    setPages(nextPages);
    setIsDirty(true);
  };

  const handleLeave = () => {
    if (!isDirty) return true;
    return window.confirm('You have unsaved changes. Leave anyway?');
  };

  const goBack = () => {
    if (handleLeave()) navigate('/');
  };

  const manualSave = async () => {
    try {
      localStorage.setItem(pagesStorageKey, JSON.stringify(pages));
      localStorage.setItem(outlineStorageKey, JSON.stringify(outline));
      await saveToFolder(pages, outline);
      setIsDirty(false);
      setSaveMessage('Saved to folder');
      window.setTimeout(() => setSaveMessage(''), 2000);
    } catch {
      setSaveMessage('Local save only');
      window.setTimeout(() => setSaveMessage(''), 2000);
    }
  };

  const handleImportPageClick = () => {
    importInputRef.current?.click();
  };

  const handleImportPage = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    try {
      const text = await file.text();
      const fileTitle = file.name.replace(/\.[^.]+$/, '') || `Page ${pages.length + 1}`;
      const replaceCurrent = window.confirm(
        'Press OK to replace the current page. Press Cancel to import as a new page.'
      );

      let nextPages: Page[];
      let nextActivePageId = activePageId;

      if (replaceCurrent && activePageId) {
        nextPages = pages.map((page) =>
          page.id === activePageId
            ? { ...page, title: fileTitle, content: text }
            : page
        );
      } else {
        const newPage: Page = {
          id: `p-${Date.now()}`,
          title: fileTitle,
          content: text,
          linkedChapterIds: [],
        };
        nextPages = [...pages, newPage];
        nextActivePageId = newPage.id;
      }

      persistWorkspaceLocal(nextPages, outline);
      setActivePageId(nextActivePageId);
      setIsDirty(false);

      try {
        await saveToFolder(nextPages, outline);
        setSaveMessage('Page imported');
      } catch {
        setSaveMessage('Page imported locally');
      }

      window.setTimeout(() => setSaveMessage(''), 2000);
    } finally {
      event.target.value = '';
    }
  };

  const createPlanningTask = (date: string): PlanningTask => ({
    id: createId('task'),
    title: 'New task',
    description: '',
    date,
    status: 'todo',
    comments: [],
    linkedChapterIds: [],
    linkedPartIds: [],
    linkedEventIds: [],
  });

  const addTask = (date = selectedPlanningDate) => {
    const nextTask = createPlanningTask(date);

    setOutline((current) => ({
      ...current,
      tasks: [...current.tasks, nextTask],
    }));
    setSelectedTaskId(nextTask.id);
    setSelectedPlanningDate(date);
    setDisplayMonth(getMonthStart(parseDateInputValue(date)));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const updateTask = (taskId: string, updates: Partial<PlanningTask>) => {
    setOutline((current) => ({
      ...current,
      tasks: current.tasks.map((task) => (task.id === taskId ? { ...task, ...updates } : task)),
    }));
    setIsDirty(true);
  };

  const removeTask = (taskId: string) => {
    setOutline((current) => ({
      ...current,
      tasks: current.tasks.filter((task) => task.id !== taskId),
    }));
    setSelectedTaskId((current) => (current === taskId ? null : current));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const toggleTaskLink = (
    taskId: string,
    linkKey: 'linkedChapterIds' | 'linkedPartIds' | 'linkedEventIds',
    linkedId: string
  ) => {
    setOutline((current) => ({
      ...current,
      tasks: current.tasks.map((task) => {
        if (task.id !== taskId) {
          return task;
        }

        const nextIds = task[linkKey].includes(linkedId)
          ? task[linkKey].filter((value) => value !== linkedId)
          : [...task[linkKey], linkedId];

        return {
          ...task,
          [linkKey]: nextIds,
        };
      }),
    }));
    setIsDirty(true);
  };

  const addTaskComment = (taskId: string, rawBody: string) => {
    const trimmedBody = rawBody.trim();

    if (!trimmedBody) {
      return;
    }

    const nextComment: PlanningTaskComment = {
      id: createId('comment'),
      body: trimmedBody,
      createdAt: new Date().toISOString(),
    };

    setOutline((current) => ({
      ...current,
      tasks: current.tasks.map((task) =>
        task.id === taskId
          ? {
              ...task,
              comments: [...task.comments, nextComment],
            }
          : task
      ),
    }));
    setTaskCommentDraft('');
    setIsDirty(true);
  };

  const openTaskInPlanning = (task: PlanningTask) => {
    setSelectedTaskId(task.id);
    setSelectedPlanningDate(task.date);
    setDisplayMonth(getMonthStart(parseDateInputValue(task.date)));
    setActiveView('planning');
  };

  const getTaskLinkBadges = (task: PlanningTask) => [
    ...task.linkedChapterIds
      .map((chapterId) => chapterMap.get(chapterId))
      .filter(Boolean)
      .map((chapter) => ({
        key: `chapter:${chapter!.id}`,
        label: chapter!.title,
        kind: 'chapter',
      })),
    ...task.linkedPartIds
      .map((partId) => partMap.get(partId))
      .filter(Boolean)
      .map((part) => ({
        key: `part:${part!.id}`,
        label: part!.title,
        kind: 'part',
      })),
    ...task.linkedEventIds
      .map((eventId) => eventContextMap.get(eventId))
      .filter(Boolean)
      .map((eventContext) => ({
        key: `event:${eventContext!.eventId}`,
        label: eventContext!.eventTitle,
        kind: 'event',
      })),
  ];

  return (
    <Layout>
      <div className={`page-shell ${activeView === 'planning' ? 'planning-mode' : ''}`}>
        <aside className="workspace-sidebar">
          <div className="brand">Writer's Companion</div>
          <button className="secondary-action" onClick={goBack}>
            Back to Dashboard
          </button>

          <div className="book-meta">
            <h1 className="book-meta-title">{book?.title ?? 'Book'}</h1>
            <div className="book-meta-author">{book?.author ?? 'Unknown author'}</div>
          </div>

          <nav className="nav">
            <button className={activeView === 'editor' ? 'active' : ''} onClick={() => setActiveView('editor')}>
              Editor
            </button>
            <button className={activeView === 'outline' ? 'active' : ''} onClick={() => setActiveView('outline')}>
              Outline
            </button>
            <button className={activeView === 'planning' ? 'active' : ''} onClick={() => setActiveView('planning')}>
              Planning
            </button>
            <button className={activeView === 'settings' ? 'active' : ''} onClick={() => setActiveView('settings')}>
              Settings
            </button>
          </nav>
        </aside>

        <main className="content">
          <div className="workspace-header">
            <div className="header-copy">
              <Link className="back" to="/" onClick={handleLeave}>
                Back to Dashboard
              </Link>
              <div className="book-title">{book?.title ?? 'Book Workspace'}</div>
              <div className="workspace-subtitle">
                Draft, revise, and manage pages in one place.
              </div>
            </div>

            <div className="actions">
              <span className="status">{isDirty ? 'Unsaved changes' : 'Ready'}</span>
              {saveMessage ? <span className="status">{saveMessage}</span> : null}
              <button className="primary-action" onClick={manualSave}>
                Save
              </button>
              <button className="secondary-action" onClick={handleImportPageClick}>
                Import Page
              </button>
              <input
                ref={importInputRef}
                type="file"
                accept=".txt,.md,.rtf,text/plain,text/markdown"
                onChange={handleImportPage}
                style={{ display: 'none' }}
              />
            </div>
          </div>

          {activeView === 'editor' && (
            <div className="panel">
              <div className="page-list">
                {pages.map((page) => (
                  <button
                    key={page.id}
                    className={`page-pill ${page.id === activePageId ? 'active' : ''}`}
                    onClick={() => {
                      if (handleLeave()) {
                        setActivePageId(page.id);
                      }
                    }}
                  >
                    <span className="page-pill-title">{page.title}</span>
                    {page.linkedChapterIds.length > 0 ? (
                      <span className="page-pill-tags">
                        {page.linkedChapterIds
                          .map((chapterId) => chapterMap.get(chapterId))
                          .filter(Boolean)
                          .slice(0, 1)
                          .map((chapter) => (
                            <span key={chapter!.id} className="page-pill-tag">
                              {chapter!.title}
                            </span>
                          ))}
                        {page.linkedChapterIds.length > 1 ? (
                          <span className="page-pill-tag">+{page.linkedChapterIds.length - 1}</span>
                        ) : null}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>

              {activePage ? (
                <div className="page-link-panel">
                  <div className="page-link-label">Page chapter tags</div>

                  {outline.chapters.length === 0 ? (
                    <div className="page-link-empty">
                      No chapters exist yet. Add chapters in the outline view first.
                    </div>
                  ) : (
                    <details className="page-link-dropdown">
                      <summary className="page-link-trigger">
                        <div className="page-link-trigger-copy">
                          <span className="page-link-trigger-title">Chapter tags</span>
                          <span className="page-link-trigger-subtitle">
                            {activePage.linkedChapterIds.length > 0
                              ? `${activePage.linkedChapterIds.length} linked`
                              : 'No chapter tags selected'}
                          </span>
                        </div>

                        <div className="page-link-trigger-meta">
                          {activePage.linkedChapterIds
                            .map((chapterId) => chapterMap.get(chapterId))
                            .filter(Boolean)
                            .slice(0, 2)
                            .map((chapter) => (
                              <span key={chapter!.id} className="page-link-trigger-tag">
                                {chapter!.title}
                              </span>
                            ))}
                          {activePage.linkedChapterIds.length > 2 ? (
                            <span className="page-link-trigger-count">
                              +{activePage.linkedChapterIds.length - 2}
                            </span>
                          ) : null}
                          <span className="page-link-caret">▾</span>
                        </div>
                      </summary>

                      <div className="page-link-menu">
                        <div className="page-link-options">
                          {outline.chapters.map((chapter) => {
                            const contexts = chapterUsageMap.get(chapter.id) ?? [];
                            const isLinked = activePage.linkedChapterIds.includes(chapter.id);

                            return (
                              <label
                                key={chapter.id}
                                className={`page-link-option ${isLinked ? 'is-linked' : ''}`}
                              >
                                <input
                                  type="checkbox"
                                  checked={isLinked}
                                  onChange={() => togglePageChapter(activePage.id, chapter.id)}
                                />
                                <div className="page-link-copy">
                                  <span className="page-link-title">{chapter.title}</span>
                                  {contexts.length > 0 ? (
                                    <div className="page-link-contexts">
                                      {contexts.map((context) => (
                                        <React.Fragment key={`${context.partId}:${context.eventId}`}>
                                          <span className="page-meta-tag part-tag">{context.partTitle}</span>
                                          <span className="page-meta-tag">{context.eventTitle}</span>
                                        </React.Fragment>
                                      ))}
                                    </div>
                                  ) : (
                                    <span className="page-link-empty-context">
                                      This chapter is not linked to an event yet.
                                    </span>
                                  )}
                                </div>
                              </label>
                            );
                          })}
                        </div>
                      </div>
                    </details>
                  )}

                  {activePage.linkedChapterIds.length > 0 ? (
                    <div className="page-linked-chapters">
                      {activePage.linkedChapterIds
                        .map((chapterId) => chapterMap.get(chapterId))
                        .filter(Boolean)
                        .map((chapter) => (
                          <span key={chapter!.id} className="page-linked-chapter-tag">
                            {chapter!.title}
                          </span>
                        ))}
                    </div>
                  ) : null}

                  <div className="planned-task-panel">
                    <div className="page-link-label">Current plan</div>
                    {currentPlannedTask ? (
                      <div className="planned-task-card">
                        <div className="planned-task-card-header">
                          <div>
                            <div className="planned-task-title">{currentPlannedTask.title}</div>
                            <div className="planned-task-subtitle">
                              {fullDateFormatter.format(parseDateInputValue(currentPlannedTask.date))} ·{' '}
                              {statusLabel[currentPlannedTask.status]}
                            </div>
                          </div>

                          <button
                            className="ghost-action"
                            onClick={() => openTaskInPlanning(currentPlannedTask)}
                          >
                            Open in Planning
                          </button>
                        </div>

                        {currentPlannedTask.description ? (
                          <div className="planned-task-description">{currentPlannedTask.description}</div>
                        ) : null}

                        <div className="planned-task-tags">
                          <div className="planned-task-tag-list">
                            <span className={`task-status-badge status-${currentPlannedTask.status}`}>
                              {statusLabel[currentPlannedTask.status]}
                            </span>
                            <span className="planning-count-pill">
                              {currentPlannedTask.comments.length} comment
                              {currentPlannedTask.comments.length === 1 ? '' : 's'}
                            </span>
                            {getTaskLinkBadges(currentPlannedTask).map((badge) => (
                              <span key={badge.key} className={`planned-task-tag kind-${badge.kind}`}>
                                {badge.label}
                              </span>
                            ))}
                          </div>
                        </div>

                        {relevantPlanningTasks.length > 1 ? (
                          <div className="planned-task-queue">
                            {relevantPlanningTasks
                              .filter((task) => task.id !== currentPlannedTask.id)
                              .slice(0, 3)
                              .map((task) => (
                                <button
                                  key={task.id}
                                  className="planned-task-queue-item"
                                  onClick={() => openTaskInPlanning(task)}
                                >
                                  <span className="planned-task-queue-header">
                                    <span className="queue-task-title">{task.title}</span>
                                    <span className="queue-task-date">
                                      {fullDateFormatter.format(parseDateInputValue(task.date))}
                                    </span>
                                  </span>
                                  <span className="planned-task-subtitle">
                                    {statusLabel[task.status]}
                                  </span>
                                </button>
                              ))}
                          </div>
                        ) : null}
                      </div>
                    ) : (
                      <div className="planned-task-empty">
                        {activePage.linkedChapterIds.length > 0
                          ? 'No planned tasks are linked to this page yet. Add them from Planning.'
                          : 'Link this page to a chapter to surface tasks tied to its chapters, parts, and events.'}
                      </div>
                    )}
                  </div>
                </div>
              ) : null}

              <ReactQuill
                key={activePageId}
                value={activePage?.content ?? ''}
                onChange={updateActivePage}
                className="editor"
                placeholder="Start writing this page..."
              />
            </div>
          )}

          {activeView === 'outline' && (
            <div className="panel outline-panel">
              <div className="outline-summary">
                <div className="summary-card">
                  <span>Parts</span>
                  <strong>{outline.parts.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Events</span>
                  <strong>{outlineEvents.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Chapters</span>
                  <strong>{outline.chapters.length}</strong>
                </div>
                <div className="summary-card">
                  <span>Completed parts</span>
                  <strong>{completedParts}</strong>
                </div>
                <div className="summary-card">
                  <span>Completed events</span>
                  <strong>{completedEvents}</strong>
                </div>
              </div>

              <div className="outline-toolbar">
                <div className="workspace-subtitle">
                  Structure the book into parts, track key events, and link each event to none or multiple chapters.
                </div>
                <button className="primary-action" onClick={addPart}>
                  Add Part
                </button>
              </div>

              <div className="chapter-library">
                {outline.chapters.length === 0 ? (
                  <div className="chapter-library-empty">
                    No chapters yet. Add one from an event's chapter picker.
                  </div>
                ) : (
                  outline.chapters.map((chapter) => (
                    <span key={chapter.id} className="chapter-chip">
                      {chapter.title}
                    </span>
                  ))
                )}
              </div>

              {outline.parts.length === 0 && (
                <div className="outline-empty">
                  No parts yet. Start by adding a part, then add the key events that belong to it.
                </div>
              )}

              <div className="outline-parts">
                {outline.parts.map((part) => (
                  <section key={part.id} className="outline-part-card">
                    <div className="outline-part-header">
                      <input
                        className="outline-field"
                        value={part.title}
                        onChange={(event) => updatePart(part.id, { title: event.target.value })}
                        placeholder="Part title"
                      />
                      <select
                        className="outline-select"
                        value={part.status}
                        onChange={(event) =>
                          updatePart(part.id, { status: event.target.value as OutlineStatus })
                        }
                      >
                        <option value="todo">To do</option>
                        <option value="in-progress">In progress</option>
                        <option value="blocked">Blocked</option>
                        <option value="done">Done</option>
                      </select>
                      <span className="status-pill">{getPartStatus(part)}</span>
                      <button className="ghost-action" onClick={() => removePart(part.id)}>
                        Remove Part
                      </button>
                    </div>

                    <textarea
                      className="outline-textarea"
                      value={part.description}
                      onChange={(event) =>
                        updatePart(part.id, { description: event.target.value })
                      }
                      placeholder="Describe what this section of the book needs to achieve."
                    />

                    <div className="outline-events">
                      {part.events.map((outlineEvent) => {
                        const linkedChapters = outlineEvent.linkedChapterIds
                          .map((chapterId) => chapterMap.get(chapterId))
                          .filter(Boolean) as OutlineChapter[];

                        const linkedChapterText =
                          linkedChapters.length > 0
                            ? linkedChapters.map((chapter) => chapter.title).join(', ')
                            : 'No chapters linked';

                        const chapterDraft = chapterDraftByEventId[outlineEvent.id] ?? '';
                        const isAddingChapter = addingChapterEventId === outlineEvent.id;

                        return (
                          <div key={outlineEvent.id} className="outline-event-row">
                            <div className="outline-event-details">
                              <input
                                className="outline-field"
                                value={outlineEvent.title}
                                onChange={(event) =>
                                  updateEvent(part.id, outlineEvent.id, {
                                    title: event.target.value,
                                  })
                                }
                                placeholder="Event title"
                              />
                              <textarea
                                className="outline-textarea"
                                value={outlineEvent.description}
                                onChange={(event) =>
                                  updateEvent(part.id, outlineEvent.id, {
                                    description: event.target.value,
                                  })
                                }
                                placeholder="What happens in this event?"
                              />
                              <div className="linked-chapter-list">
                                {linkedChapters.length > 0 ? (
                                  linkedChapters.map((chapter) => (
                                    <span key={chapter.id} className="linked-chapter-chip">
                                      {chapter.title}
                                    </span>
                                  ))
                                ) : (
                                  <span className="linked-chapter-empty">No chapter links yet.</span>
                                )}
                              </div>
                            </div>

                            <select
                              className="outline-select"
                              value={outlineEvent.status}
                              onChange={(event) =>
                                updateEvent(part.id, outlineEvent.id, {
                                  status: event.target.value as OutlineStatus,
                                })
                              }
                            >
                              <option value="todo">To do</option>
                              <option value="in-progress">In progress</option>
                              <option value="blocked">Blocked</option>
                              <option value="done">Done</option>
                            </select>

                            <div className="chapter-picker">
                              <details className="chapter-dropdown">
                                <summary className="chapter-trigger">
                                  <span className="chapter-trigger-text">{linkedChapterText}</span>
                                  <span className="chapter-trigger-add">+</span>
                                </summary>

                                <div className="chapter-menu">
                                  {outline.chapters.length === 0 ? (
                                    <div className="chapter-menu-empty">
                                      No chapters yet. Add one below.
                                    </div>
                                  ) : (
                                    outline.chapters.map((chapter) => (
                                      <label key={chapter.id} className="chapter-option">
                                        <input
                                          type="checkbox"
                                          checked={outlineEvent.linkedChapterIds.includes(chapter.id)}
                                          onChange={() =>
                                            toggleEventChapter(part.id, outlineEvent.id, chapter.id)
                                          }
                                        />
                                        <span>{chapter.title}</span>
                                      </label>
                                    ))
                                  )}

                                  {isAddingChapter ? (
                                    <div className="chapter-create">
                                      <input
                                        className="outline-field"
                                        value={chapterDraft}
                                        onChange={(event) =>
                                          updateChapterDraft(outlineEvent.id, event.target.value)
                                        }
                                        placeholder="New chapter title"
                                        autoFocus
                                        onKeyDown={(event) => {
                                          if (event.key === 'Enter') {
                                            event.preventDefault();
                                            createChapterForEvent(part.id, outlineEvent.id, chapterDraft);
                                          }

                                          if (event.key === 'Escape') {
                                            event.preventDefault();
                                            cancelAddingChapter(outlineEvent.id);
                                          }
                                        }}
                                      />
                                      <button
                                        className="ghost-action"
                                        onClick={(clickEvent) => {
                                          clickEvent.preventDefault();
                                          clickEvent.stopPropagation();
                                          createChapterForEvent(part.id, outlineEvent.id, chapterDraft);
                                        }}
                                      >
                                        Create chapter
                                      </button>
                                      <button
                                        className="ghost-action"
                                        onClick={(clickEvent) => {
                                          clickEvent.preventDefault();
                                          clickEvent.stopPropagation();
                                          cancelAddingChapter(outlineEvent.id);
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  ) : (
                                    <button
                                      className="ghost-action"
                                      onClick={(clickEvent) => {
                                        clickEvent.preventDefault();
                                        clickEvent.stopPropagation();
                                        startAddingChapter(outlineEvent.id);
                                      }}
                                    >
                                      + Add chapter
                                    </button>
                                  )}
                                </div>
                              </details>
                            </div>

                            <button
                              className="ghost-action"
                              onClick={() => removeEvent(part.id, outlineEvent.id)}
                            >
                              Remove Event
                            </button>
                          </div>
                        );
                      })}
                    </div>

                    <button className="secondary-action" onClick={() => addEvent(part.id)}>
                      Add Event
                    </button>
                  </section>
                ))}
              </div>
            </div>
          )}

          {activeView === 'planning' && (
            <div className="panel planning-panel">
              <div className="planning-summary">
                <div className="planning-summary-card">
                  <div className="planning-summary-label">Total tasks</div>
                  <div className="planning-summary-value">{outline.tasks.length}</div>
                </div>
                <div className="planning-summary-card">
                  <div className="planning-summary-label">Due in 7 days</div>
                  <div className="planning-summary-value">{tasksThisWeek}</div>
                </div>
                <div className="planning-summary-card">
                  <div className="planning-summary-label">In progress</div>
                  <div className="planning-summary-value">{inProgressTasks}</div>
                </div>
                <div className="planning-summary-card">
                  <div className="planning-summary-label">Blocked</div>
                  <div className="planning-summary-value">{blockedTasks}</div>
                </div>
              </div>

              <div className="planning-layout">
                <section className="planning-calendar-card">
                  <div className="planning-toolbar">
                    <div>
                      <div className="planning-section-title">Task calendar</div>
                      <div className="planning-copy">
                        Schedule work visually, then link each task back to the chapter, part, and event it serves.
                      </div>
                    </div>

                    <div className="planning-month-controls">
                      <button
                        className="ghost-action"
                        onClick={() =>
                          setDisplayMonth(
                            (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
                          )
                        }
                      >
                        Previous
                      </button>
                      <div className="planning-month-label">{monthLabelFormatter.format(displayMonth)}</div>
                      <button
                        className="ghost-action"
                        onClick={() =>
                          setDisplayMonth(
                            (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
                          )
                        }
                      >
                        Next
                      </button>
                    </div>
                  </div>

                  <div className="planning-calendar-scroll">
                    <div className="planning-weekdays">
                      {Array.from({ length: 7 }, (_, index) => {
                        const day = addDays(new Date(2026, 0, 4), index);
                        return (
                          <div key={day.toISOString()} className="planning-weekday">
                            {dayLabelFormatter.format(day)}
                          </div>
                        );
                      })}
                    </div>

                    <div className="planning-calendar-grid">
                      {calendarDays.map((calendarDay) => {
                        const dateKey = formatDateInputValue(calendarDay);
                        const dayTasks = tasksByDate.get(dateKey) ?? [];
                        const isToday = isSameDay(calendarDay, new Date());
                        const isSelected = selectedPlanningDate === dateKey;
                        const fullDateLabel = fullDateFormatter.format(calendarDay);
                        const dayBadge = isToday
                          ? 'Today'
                          : calendarDay.getDate() === 1
                            ? shortMonthFormatter.format(calendarDay)
                            : null;

                        return (
                          <div
                            key={dateKey}
                            className={`calendar-day ${
                              isSameMonth(calendarDay, displayMonth) ? '' : 'is-outside-month'
                            } ${isSelected ? 'is-selected' : ''} ${isToday ? 'is-today' : ''}`}
                          >
                            <button
                              className="calendar-day-header"
                              onClick={() => {
                                setSelectedPlanningDate(dateKey);
                                setSelectedTaskId(null);
                              }}
                            >
                              <span className="calendar-day-topline">
                                <span className="calendar-day-number">{calendarDay.getDate()}</span>
                                {dayBadge ? <span className="calendar-day-badge">{dayBadge}</span> : null}
                              </span>
                              <span className="calendar-day-label">{fullDateLabel}</span>
                            </button>

                            <div className="calendar-day-tasks">
                              {dayTasks.map((task) => (
                                <button
                                  key={task.id}
                                  className={`task-block status-${task.status} ${
                                    selectedTaskId === task.id ? 'active' : ''
                                  }`}
                                  onClick={() => {
                                    setSelectedTaskId(task.id);
                                    setSelectedPlanningDate(task.date);
                                  }}
                                >
                                  <div className="task-block-copy">
                                    <span className="task-block-title">{task.title}</span>
                                    <span className="task-block-meta">
                                      {statusLabel[task.status]} · {task.comments.length} comment
                                      {task.comments.length === 1 ? '' : 's'}
                                    </span>
                                  </div>
                                  <div className="task-block-tags">
                                    {getTaskLinkBadges(task)
                                      .slice(0, 2)
                                      .map((badge) => (
                                        <span key={badge.key} className={`task-block-tag kind-${badge.kind}`}>
                                          {badge.label}
                                        </span>
                                      ))}
                                  </div>
                                </button>
                              ))}
                            </div>

                            <button
                              className="calendar-add-task"
                              aria-label={`Add task for ${fullDateLabel}`}
                              onClick={() => addTask(dateKey)}
                            >
                              + Task
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                </section>

                <aside className="planning-inspector">
                  <div className="planning-inspector-header">
                    <div>
                      <div className="planning-section-title">Planner</div>
                      <div className="planning-copy">
                        {selectedTask
                          ? 'Refine the selected task, connect it to story structure, and capture comments.'
                          : `Select a task or create one for ${fullDateFormatter.format(
                              parseDateInputValue(selectedPlanningDate)
                            )}.`}
                      </div>
                    </div>

                    {!selectedTask ? (
                      <button className="primary-action" onClick={() => addTask(selectedPlanningDate)}>
                        New Task
                      </button>
                    ) : null}
                  </div>

                  {selectedTask ? (
                    <div className="planning-form">
                      <div className="planning-form-header">
                        <div className="planning-section-title">Task details</div>
                        <button className="ghost-action" onClick={() => removeTask(selectedTask.id)}>
                          Delete Task
                        </button>
                      </div>

                      <input
                        className="outline-field"
                        value={selectedTask.title}
                        onChange={(event) => updateTask(selectedTask.id, { title: event.target.value })}
                        placeholder="Task title"
                      />

                      <div className="planning-form-row">
                        <input
                          className="outline-field"
                          type="date"
                          value={selectedTask.date}
                          onChange={(event) => updateTask(selectedTask.id, { date: event.target.value })}
                        />
                        <select
                          className="outline-select"
                          value={selectedTask.status}
                          onChange={(event) =>
                            updateTask(selectedTask.id, {
                              status: event.target.value as OutlineStatus,
                            })
                          }
                        >
                          <option value="todo">To do</option>
                          <option value="in-progress">In progress</option>
                          <option value="blocked">Blocked</option>
                          <option value="done">Done</option>
                        </select>
                      </div>

                      <textarea
                        className="outline-textarea"
                        value={selectedTask.description}
                        onChange={(event) =>
                          updateTask(selectedTask.id, { description: event.target.value })
                        }
                        placeholder="Describe the writing work or revision goal."
                      />

                      <div className="planning-section">
                        <div className="planning-section-title">Story links</div>
                        <div className="planning-link-list">
                          <div className="planning-link-group">
                            <div className="planning-helper">Chapters</div>
                            {outline.chapters.length > 0 ? (
                              <div className="planning-link-options">
                                {outline.chapters.map((chapter) => {
                                  const isLinked = selectedTask.linkedChapterIds.includes(chapter.id);

                                  return (
                                    <button
                                      key={chapter.id}
                                      type="button"
                                      className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                                      onClick={() =>
                                        toggleTaskLink(selectedTask.id, 'linkedChapterIds', chapter.id)
                                      }
                                    >
                                      <span className="planning-link-option-copy">
                                        <span className="planning-link-option-title">{chapter.title}</span>
                                        <span className="planning-link-option-subtitle">Chapter</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="planning-link-empty">No chapters available yet.</div>
                            )}
                          </div>

                          <div className="planning-link-group">
                            <div className="planning-helper">Parts</div>
                            {outline.parts.length > 0 ? (
                              <div className="planning-link-options">
                                {outline.parts.map((part) => {
                                  const isLinked = selectedTask.linkedPartIds.includes(part.id);

                                  return (
                                    <button
                                      key={part.id}
                                      type="button"
                                      className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                                      onClick={() =>
                                        toggleTaskLink(selectedTask.id, 'linkedPartIds', part.id)
                                      }
                                    >
                                      <span className="planning-link-option-copy">
                                        <span className="planning-link-option-title">{part.title}</span>
                                        <span className="planning-link-option-subtitle">Part</span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="planning-link-empty">No parts available yet.</div>
                            )}
                          </div>

                          <div className="planning-link-group">
                            <div className="planning-helper">Events</div>
                            {outlineEvents.length > 0 ? (
                              <div className="planning-link-options">
                                {outlineEvents.map((outlineEvent) => {
                                  const isLinked = selectedTask.linkedEventIds.includes(outlineEvent.id);
                                  const eventContext = eventContextMap.get(outlineEvent.id);

                                  return (
                                    <button
                                      key={outlineEvent.id}
                                      type="button"
                                      className={`planning-link-option ${isLinked ? 'is-linked' : ''}`}
                                      onClick={() =>
                                        toggleTaskLink(selectedTask.id, 'linkedEventIds', outlineEvent.id)
                                      }
                                    >
                                      <span className="planning-link-option-copy">
                                        <span className="planning-link-option-title">{outlineEvent.title}</span>
                                        <span className="planning-link-option-subtitle">
                                          {eventContext ? eventContext.partTitle : 'Event'}
                                        </span>
                                      </span>
                                    </button>
                                  );
                                })}
                              </div>
                            ) : (
                              <div className="planning-link-empty">No events available yet.</div>
                            )}
                          </div>
                        </div>

                        <div className="planned-task-tag-list">
                          {getTaskLinkBadges(selectedTask).length > 0 ? (
                            getTaskLinkBadges(selectedTask).map((badge) => (
                              <span key={badge.key} className={`planning-link-chip kind-${badge.kind}`}>
                                {badge.label}
                              </span>
                            ))
                          ) : (
                            <span className="planning-link-empty">
                              This task is not linked yet. Connect it to the story structure above.
                            </span>
                          )}
                        </div>
                      </div>

                      <div className="planning-section">
                        <div className="planning-section-title">Comments</div>
                        {selectedTask.comments.length > 0 ? (
                          <div className="task-comment-list">
                            {selectedTask.comments.map((comment) => (
                              <div key={comment.id} className="task-comment-item">
                                <div className="comment-header">
                                  <span className="comment-title">Note</span>
                                  <span className="comment-meta">
                                    {new Date(comment.createdAt).toLocaleString()}
                                  </span>
                                </div>
                                <div className="comment-body">{comment.body}</div>
                              </div>
                            ))}
                          </div>
                        ) : (
                          <div className="planning-empty">No comments yet.</div>
                        )}

                        <div className="task-comment-composer">
                          <textarea
                            className="outline-textarea"
                            placeholder="Add a comment about this task"
                            value={taskCommentDraft}
                            onChange={(event) => setTaskCommentDraft(event.target.value)}
                          />
                          <button
                            className="secondary-action"
                            onClick={() => addTaskComment(selectedTask.id, taskCommentDraft)}
                          >
                            Add Comment
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="planning-empty">
                      Create a task for the selected date, or pick a task block from the calendar to edit it.
                    </div>
                  )}
                </aside>
              </div>
            </div>
          )}
          {activeView === 'settings' && <div className="panel">Settings view (placeholder)</div>}
        </main>
      </div>
    </Layout>
  );
};

export default BookWorkspace;