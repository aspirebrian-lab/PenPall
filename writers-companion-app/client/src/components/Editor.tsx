import React, { useState } from 'react';
import ReactQuill from 'react-quill-new';
import 'react-quill-new/dist/quill.snow.css';
import styled from 'styled-components';
import { useStoryContext } from '../hooks/useStoryContext';

const EditorContainer = styled.div`
  .quill-editor {
    background: white;
    border-radius: 8px;
    padding: 20px;
    box-shadow: 0 2px 10px rgba(0, 0, 0, 0.1);
  }

  .tags {
    margin-top: 20px;
  }

  .tag-input {
    display: flex;
    gap: 10px;
    margin-bottom: 10px;
  }

  .tag {
    background: #3498db;
    color: white;
    padding: 5px 10px;
    border-radius: 4px;
    display: inline-block;
    margin-right: 5px;
  }
`;

const Editor: React.FC = () => {
  const { story, setStory } = useStoryContext();
  const [tags, setTags] = useState<string[]>([]);
  const [newTag, setNewTag] = useState('');

  const handleAddTag = () => {
    if (newTag && !tags.includes(newTag)) {
      setTags([...tags, newTag]);
      setNewTag('');
    }
  };

  const modules = {
    toolbar: [
      [{ 'header': [1, 2, false] }],
      ['bold', 'italic', 'underline', 'strike', 'blockquote'],
      [{'list': 'ordered'}, {'list': 'bullet'}, {'indent': '-1'}, {'indent': '+1'}],
      ['link', 'image'],
      ['clean']
    ],
  };

  return (
    <EditorContainer>
      <ReactQuill
        value={story}
        onChange={setStory}
        modules={modules}
        className="quill-editor"
        placeholder="Start writing your book..."
      />
      <div className="tags">
        <h3>Tags</h3>
        <div className="tag-input">
          <input
            type="text"
            placeholder="Add a tag (e.g., Part 1, Chapter 1)"
            value={newTag}
            onChange={(e) => setNewTag(e.target.value)}
          />
          <button onClick={handleAddTag}>Add Tag</button>
        </div>
        {tags.map((tag, index) => (
          <span key={index} className="tag">{tag}</span>
        ))}
      </div>
    </EditorContainer>
  );
};

export default Editor;