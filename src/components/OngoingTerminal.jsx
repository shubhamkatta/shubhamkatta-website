export function OngoingTerminal() {
  return (
    <div className="terminal-card" role="presentation" aria-label="Ongoing projects, in a tree view">
      <div className="terminal-titlebar">
        <span className="terminal-dot terminal-dot-red" aria-hidden="true" />
        <span className="terminal-dot terminal-dot-yellow" aria-hidden="true" />
        <span className="terminal-dot terminal-dot-green" aria-hidden="true" />
        <span className="terminal-title">~/ongoing — zsh</span>
      </div>
      <pre className="terminal-body"><code>
<span className="t-user">shubham@desk</span> <span className="t-path">~/ongoing</span> <span className="t-arrow">$</span> <span className="t-cmd">tree --depth=2 --status</span>{'\n'}
.{'\n'}
<span className="t-tree">├── </span><span className="t-dir">ai-native-threat-intel/</span>{'    '}<span className="t-comment"># day job · year six at Cyble</span>{'\n'}
<span className="t-tree">│   ├── </span><span className="t-key">status</span>{'     '}[<span className="t-tag t-tag-green">RUNNING</span>]{'\n'}
<span className="t-tree">│   ├── </span><span className="t-key">focus</span>{'      '}turning indicators into action, faster{'\n'}
<span className="t-tree">│   └── </span><span className="t-key">lately</span>{'     '}the agent loop that watches the wire{'\n'}
<span className="t-tree">│</span>{'\n'}
<span className="t-tree">├── </span><span className="t-dir">personal-health-agent/</span>{'     '}<span className="t-comment"># nights · evenings</span>{'\n'}
<span className="t-tree">│   ├── </span><span className="t-key">status</span>{'     '}[<span className="t-tag t-tag-yellow">DRAFTING</span>]{'\n'}
<span className="t-tree">│   ├── </span><span className="t-key">stack</span>{'      '}claude + whoop + obsidian + a quiet stubbornness{'\n'}
<span className="t-tree">│   └── </span><span className="t-key">asks</span>{'       '}what is my body saying that I keep ignoring?{'\n'}
<span className="t-tree">│</span>{'\n'}
<span className="t-tree">└── </span><span className="t-dir">plynth/</span>{'                    '}<span className="t-comment"># weekends · public</span>{'\n'}
<span className="t-tree">    ├── </span><span className="t-key">status</span>{'     '}[<span className="t-tag t-tag-blue">SHIPPING</span>]{'\n'}
<span className="t-tree">    ├── </span><span className="t-key">pitch</span>{'      '}saas plumbing I rebuilt four times so yours can be one{'\n'}
<span className="t-tree">    └── </span><span className="t-key">repo</span>{'       '}<a href="https://github.com/shubhamkatta/plynth" target="_blank" rel="noopener noreferrer">github.com/shubhamkatta/plynth</a>{'\n\n'}
<span className="t-user">shubham@desk</span> <span className="t-path">~/ongoing</span> <span className="t-arrow">$</span> <span className="t-cursor" aria-hidden="true">▋</span>
      </code></pre>
    </div>
  );
}
