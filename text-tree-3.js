// TODOs
//
//  regionActive is not a binary, it's ternary
//    0 - no region
//    1 - cursor + group below
//    2 - cursor + lines until a line less indented than cursor
//
//  group below means ...
//    if line below is indented more, group is the nested tree,
//    else, group is lines until differently nested line
//
//  make keyboard friendly

import {
  LitElement,
  html,
  css,
} from "https://cdn.jsdelivr.net/gh/lit/dist@2/core/lit-core.min.js";
import { map } from "https://cdn.jsdelivr.net/npm/lit-html@2.8.0/directives/map.js";
import { create, cssomSheet } from "https://cdn.skypack.dev/twind";
import { plugins, variants } from "/style.js";

const sheet = cssomSheet({ target: new CSSStyleSheet() });
const { tw, apply } = create({ sheet, plugins, variants });

class b extends LitElement {
  static styles = [
    sheet.target,
    css`
      :host {
        position: relative;
        display: flex;
        flex-direction: column;
      }
    `,
  ];

  static properties = {
    regionActive: { type: Boolean },
    cursorLine: { type: Number },
  };

  constructor() {
    super();
    this.cursorLine = undefined;
    this.regionActive = false;
    this.editorActive = false;
    this.clipboard = "";
  }

  cursor = () => {
    const lines = this.renderRoot.querySelector("slot").assignedNodes();
    return lines[this.cursorLine];
  };

  numLines = () => {
    const lines = this.renderRoot.querySelector("slot").assignedNodes();
    return lines.length;
  };

  region = () => {
    if (this.cursorLine !== undefined && !!this.regionActive) {
      return this.regionAt(this.cursor());
    } else {
      return [];
    }
  };

  readClip = async () => {
    const readPerm = await navigator.permissions.query({
      name: "clipboard-read",
    }).state;
    const writePerm = await navigator.permissions.query({
      name: "clipboard-write",
    }).state;

    if (readPerm === "granted" && writePerm === "granted") {
      return await navigator.clipboard.readText();
    } else {
      return this.clipboard;
    }
  };

  writeClip = async (text) => {
    const readPerm = await navigator.permissions.query({
      name: "clipboard-read",
    }).state;
    const writePerm = await navigator.permissions.query({
      name: "clipboard-write",
    }).state;

    if (readPerm === "granted" && writePerm === "granted") {
      navigator.clipboard.writeText(text);
    } else {
      this.clipboard = text;
    }
  };

  render() {
    // prettier-ignore
    return html`
     <div
       role="presentation"
       autocorrect="off"
       autocapitalize="none"
       tabindex="-1"
       id="navigator"
       @keydown=${this.keymap}
       class="${tw`slotted:(whitespace-pre block) flex-grow overflow-scroll flex flex-col leading-6 font-mono`}"
     >
        <slot @slotchange=${this.handleSlotchange}></slot>
     </div>

      <div id="actions" class="${tw`p-2 flex flex-wrap gap-1 children:(btn-indigo disabled:bg-gray-300)`}">
       <button @click=${this.fold} ?disabled=${this.cursorLine === undefined}>~</button>
       <button @click=${this.foldTops}>≈</button>
       <button @click=${this.edit} ?disabled=${this.cursorLine === undefined}>=</button>
       <button @click=${this.delete} ?disabled=${this.cursorLine === undefined}>D</button>
       <button @click=${this.cut} ?disabled=${this.cursorLine === undefined}>X</button>
       <button @click=${this.copy} ?disabled=${this.cursorLine === undefined}>C</button>
       <button @click=${this.paste} ?disabled=${this.cursorLine === undefined}>V</button>
       <button @click=${this.merge} ?disabled=${this.cursorLine === undefined}>M</button>
       <button @click=${this.dedent} ?disabled=${this.cursorLine === undefined}>&lt;</button>
       <button @click=${this.indent} ?disabled=${this.cursorLine === undefined}>&gt;</button>
       <button @click=${this.swapUp} ?disabled=${this.cursorLine === undefined}>^</button>
       <button @click=${this.swapDown} ?disabled=${this.cursorLine === undefined}>∨</button>
     </div>


     <div id="editor" class="${tw`absolute left-0 top-0 bg-[rgba(0,0,0,0.7)] p-2 hidden flex-col gap-2 w-full h-full`}">
       <textarea
         id="pad"
         wrap="off"
         @keydown=${(e) => e.stopPropagation()}
         autocomplete="off"
         class="${tw`block pb-8 pt-3 px-1 font-mono bg-gray-100 overflow-x-scroll resize-none rounded`}"
         @input=${(e) => e.target.rows = e.target.value.split("\n").length}
       ></textarea>
       <div class="${tw`flex gap-2 children:(btn-indigo) justify-end`}">
         <button @click=${this.cancelPad}>cancel</button>
         <button @click=${this.savePad} class="flex-grow">save</button>
       </div>
     </div>
    `;
  }

  keymap = (e) => {
    console.log("key");
    const kmap = {
      j: this.down,
      J: this.swapDown,
      k: this.up,
      K: this.swapUp,
      H: this.dedent,
      L: this.indent,
      d: this.delete,
      c: this.copy,
      x: this.cut,
      v: this.paste,
      m: this.merge,
      " ": () => {
        this.regionActive = !this.regionActive;
      },
      Tab: this.fold,
    };

    if (!e.metaKey && !e.controlKey && !!kmap[e.key]) {
      e.preventDefault();
      kmap[e.key]();
      this.styleLineDivs();
    }
  };

  up = (e) => {
    e?.preventDefault();
    this.cursorLine =
      parseInt(this.cursor()?.previousSibling?.getAttribute("line-num")) || 0;
    this.cursor().scrollIntoView({ behavior: "smooth", block: "center" });
  };

  down = (e) => {
    e?.preventDefault();
    this.cursorLine =
      parseInt(this.cursor()?.nextSibling?.getAttribute("line-num")) ||
      parseInt(this.cursor().getAttribute("line-num"));
    this.cursor().scrollIntoView({ behavior: "smooth", block: "center" });
  };

  regionAt = (node) => {
    let lines = [];
    let nodeI = parseInt(node.getAttribute("line-indent"));

    let next = node.nextSibling;
    let nextI = parseInt(next?.getAttribute("line-indent"));
    if (nodeI === nextI) {
      //  flat
      while (nextI === nodeI) {
        lines.push(next);
        next = next.nextSibling;
        nextI = parseInt(next?.getAttribute("line-indent"));
      }
    } else {
      // tree
      while (nextI > nodeI) {
        lines.push(next);
        next = next.nextSibling;
        nextI = parseInt(next?.getAttribute("line-indent"));
      }
    }
    return lines;
  };

  setCursor = (e) => {
    e?.preventDefault();
    const line = e.currentTarget;
    if (this.cursor() === line) {
      if (this.region().length) {
        this.cursorLine = undefined;
        this.regionActive = false;
      } else {
        this.regionActive = true;
      }
    } else {
      this.cursorLine = parseInt(line.getAttribute("line-num"));
      this.regionActive = false;
    }
    this.styleLineDivs();
  };

  fold = (e) => {
    e?.preventDefault();
    const activeBefore = this.regionActive;
    this.regionActive = true;
    if (this.cursor().hasAttribute("line-folded")) {
      let subregion = [];
      this.region().forEach((line) => {
        if (line.hasAttribute("line-folded")) {
          subregion = subregion.concat(this.regionAt(line));
        }
        if (!subregion.includes(line)) {
          line.classList.replace("hidden", "flex");
        }
      });
      this.cursor().removeAttribute("line-folded");
      this.cursor().classList.remove("border-b");
    } else {
      this.region().forEach((line) => {
        line.classList.replace("flex", "hidden");
      });
      this.cursor().setAttribute("line-folded", "");
      this.cursor().classList.add("border-b");
    }
    this.regionActive = activeBefore;
  };

  foldTops = (e) => {
    e?.preventDefault();
    const lines = this.renderRoot.querySelector("slot").assignedNodes();
    lines.forEach((line) => {
      if (line.getAttribute("line-indent") === "0") {
        line.setAttribute("line-folded", "");
        line.classList.add("border-b");
      } else {
        line.classList.replace("flex", "hidden");
      }
    });
  };

  merge = (e) => {
    e?.preventDefault();
    const text = this.cursor()?.textContent.trim();
    const prev = this.cursor()?.previousSibling;
    if (prev) {
      const prevText = prev?.textContent;
      this.cursor().remove();
      prev.replaceWith(prevText + "  " + text);
      this.cursorLine = this.cursorLine - 1;
    }
  };

  edit = (e) => {
    e?.preventDefault();

    const editor = this.renderRoot.querySelector("#editor");
    const pad = this.renderRoot.querySelector("#pad");
    if (editor.classList.contains("hidden")) {
      editor.classList.replace("hidden", "flex");
      const lines = [
        this.cursor()?.textContent,
        ...this.region()?.map((line) => line.textContent),
      ];
      pad.value = lines.join("\n");
      pad.rows = lines.length;
    } else {
      editor.classList.replace("flex", "hidden");
    }
  };

  savePad = (e) => {
    e?.preventDefault();
    this.region().forEach((line) => line.remove());
    const pad = this.renderRoot.querySelector("#pad");
    this.cursor().replaceWith(pad.value);
    const editor = this.renderRoot.querySelector("#editor");
    editor.classList.replace("flex", "hidden");
  };

  cancelPad = (e) => {
    e?.preventDefault();
    const editor = this.renderRoot.querySelector("#editor");
    editor.classList.replace("flex", "hidden");
  };

  delete = (e) => {
    e?.preventDefault();

    this.regionAt(this.cursor()).forEach((line) =>
      line.classList.replace("hidden", "flex")
    );
    this.region().forEach((line) => line.remove());
    this.cursor()?.remove();
    this.regionActive = false;
    this.cursorLine = undefined;
  };

  cut = (e) => {
    e?.preventDefault();
    const lines = [
      this.cursor()?.textContent,
      ...this.region()?.map((line) => line.textContent),
    ];
    const text = lines.join("\n");
    this.writeClip(text);
    this.region().forEach((line) => line.remove());
    this.cursor()?.remove();
    this.cursorLine = Math.min(this.numLines() - 1, this.cursorLine);
    this.regionActive = false;
  };

  copy = (e) => {
    e?.preventDefault();
    const lines = [
      this.cursor()?.textContent,
      ...this.region()?.map((line) => line.textContent),
    ];
    const text = lines.join("\n");
    this.writeClip(text);
  };

  paste = async (e) => {
    e?.preventDefault();
    console.log("paste");
    const pasted = await this.readClip();
    this.cursor().insertAdjacentText("beforebegin", pasted);
  };

  indent = (e) => {
    e?.preventDefault();

    if (this.cursor()) {
      let fullRegion = [this.cursor(), ...this.region()];
      let text = fullRegion.map((line) => "  " + line.textContent).join("\n");
      this.region().forEach((line) => line.remove());
      this.cursor().replaceWith(text);
    }
  };

  dedent = (e) => {
    e?.preventDefault();
    if (
      this.cursor() &&
      parseInt(this.cursor().getAttribute("line-indent")) >= 2
    ) {
      let fullRegion = [this.cursor(), ...this.region()];
      let text = fullRegion
        .map((line) => {
          const indent = parseInt(line.getAttribute("line-indent"));
          if (indent >= 2) {
            return line.textContent.slice(2);
          }
          return line.textContent;
        })
        .join("\n");
      this.region().forEach((line) => line.remove());
      this.cursor().replaceWith(text);
    }
  };

  swapUp = (e) => {
    e?.preventDefault();
    const prev = this.cursor().previousSibling;
    if (prev) {
      const lines = [this.cursor()?.textContent];
      this.cursor()?.remove();
      this.cursorLine -= 1;
      prev.insertAdjacentText("beforebegin", lines.join("\n"));
    }
  };

  swapDown = (e) => {
    e?.preventDefault();
    const end = this.cursor();
    const next = end.nextSibling;
    if (next) {
      const lines = [
        this.cursor()?.textContent,
        /* ...this.region()?.map((line) => line.textContent), */
      ];
      /* this.region()?.forEach((line) => line.remove()); */
      this.cursor()?.remove();
      this.cursorLine += 1;
      next.insertAdjacentText("afterend", lines.join("\n"));
    }
  };

  lineEmpty(line) {
    if (!line.trim().length) return true;
    return false;
  }

  textToSpans(text) {
    return text
      .split("\n")
      .filter((line) => {
        return !this.lineEmpty(line);
      })
      .map((line) => {
        const span = document.createElement("span");
        span.textContent = line;
        const indent = line.search(/\S|$/);
        span.setAttribute("text-indent", line.search(/\S|$/));
        if (line.slice(indent, indent + 2) === "::") {
          span.setAttribute("text-comment", "");
        }
        return span;
      });
  }

  spanToDiv(span) {
    const div = document.createElement("div");
    div.textContent = span.textContent;
    div.onclick = this.setCursor;
    div.setAttribute("line-indent", span.getAttribute("text-indent"));
    div.className = tw`flex cursor-normal select-none pl-1 border-gray-500 border-dashed`;
    if (span.hasAttribute("text-comment")) {
      div.classList.add("text-gray-400");
    }
    return div;
  }

  styleLineDivs = () => {
    const childNodes = this.renderRoot.querySelector("slot").assignedNodes();
    childNodes
      .filter((node) => node.nodeName === "DIV")
      .forEach((node, i) => {
        if (node === this.cursor()) {
          node.classList.remove("bg-red-100");
          node.classList.add("bg-red-200");
        } else if (this.region().includes(node)) {
          node.classList.remove("bg-red-200");
          node.classList.add("bg-red-100");
        } else {
          node.classList.remove("bg-red-200");
          node.classList.remove("bg-red-100");
        }
        node.setAttribute("line-num", i);
      });
  };

  handleSlotchange(e) {
    const childNodes = e.target.assignedNodes();
    childNodes
      .filter((node) => node.nodeName === "#text")
      .forEach((node) => {
        if (this.lineEmpty(node.textContent)) {
          node.remove();
        } else {
          const lineSpans = this.textToSpans(node.textContent);
          node.replaceWith(...lineSpans);
        }
      });

    childNodes
      .filter((node) => node.nodeName === "SPAN")
      .forEach((node) => {
        const lineDiv = this.spanToDiv(node);
        node.replaceWith(lineDiv);
      });
    this.styleLineDivs();
  }
}

customElements.define("text-tree-3", b);
