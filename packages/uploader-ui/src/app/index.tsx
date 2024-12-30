import "./app.css";

export default function App() {
  return (
    <div className="wrapper">
      <div className="file-selector">
        <div className="file-selector-header">Select Files</div>
        <div><input type="file" accept="*" multiple id="file" /></div>
      </div>
      <div className="file-list">
        <div className="file-list-header">
          <span>Filename</span>
          <span>Last modified</span>
        </div>
        <div className="file-item">
          <span>big-file.pdf</span>
          <span>February 28, 2024, 23:48:15 (UTC-08:00)</span>
        </div>
      </div>
    </div>
  )
}
