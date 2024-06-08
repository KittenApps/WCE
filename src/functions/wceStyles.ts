import { BCE_COLOR_ADJUSTMENTS_CLASS_NAME, DARK_INPUT_CLASS, WHISPER_CLASS } from "../util/constants";

const INPUT_WARN_CLASS = "bce-input-warn";

export default function wceStyles(): void {
  const css = /* CSS */ `
  .bce-beep-link {
    text-decoration: none;
  }
  #TextAreaChatLog .bce-notification,
  #TextAreaChatLog .bce-notification {
    background-color: #D696FF;
    color: black;
  }
  #TextAreaChatLog[data-colortheme="dark"] .bce-notification,
  #TextAreaChatLog[data-colortheme="dark2"] .bce-notification {
    background-color: #481D64;
    color: white;
  }
  .bce-img-link {
    vertical-align: top;
  }
  .bce-img {
    max-height: 25rem;
    max-width: 90%;
    display: inline;
    border:1px solid red;
    padding: 0.1rem;
  }
  .bce-color {
    width: 0.8em;
    height: 0.8em;
    display: inline-block;
    vertical-align: middle;
    border: 0.1em solid black;
    margin-right: 0.1em;
  }
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} .${DARK_INPUT_CLASS}.${INPUT_WARN_CLASS} {
    background-color: #400000 !important;
  }
  .${INPUT_WARN_CLASS} {
    background-color: yellow !important;
  }
  #TextAreaChatLog a,
  .bce-message a {
    color: #003f91;
    cursor: pointer;
  }
  #TextAreaChatLog a:visited,
  .bce-message a {
    color: #380091;
  }
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} div.ChatMessageWhisper,
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} div.ChatMessageWhisper {
    color: #646464;
  }
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} #TextAreaChatLog[data-colortheme="dark"] div.ChatMessageWhisper,
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} #TextAreaChatLog[data-colortheme="dark2"] div.ChatMessageWhisper {
    color: #828282;
  }
  #TextAreaChatLog[data-colortheme="dark"] a,
  #TextAreaChatLog[data-colortheme="dark2"] a,
  .bce-message a {
    color: #a9ceff;
  }
  #TextAreaChatLog[data-colortheme="dark"] a:visited,
  #TextAreaChatLog[data-colortheme="dark2"] a:visited,
  .bce-message a {
    color: #3d91ff;
  }
  .${WHISPER_CLASS} {
    font-style: italic;
  }
  .${BCE_COLOR_ADJUSTMENTS_CLASS_NAME} .${DARK_INPUT_CLASS} {
    background-color: #111;
    color: #eee;
    border-color: #333;
  }
  a.bce-button {
    text-decoration: none;
  }
  .bce-hidden {
    display: none !important;
  }
  .bce-false-hidden {
    position: absolute;
    border: 0;
    margin: 0;
    padding: 0;
    top: 0;
    left: 0;
    width: 0.1px;
    height: 0.1px;
    opacity: 0.01;
  }
  .bce-line-icon-wrapper {
    display: none;
    position: absolute;
    right: 1em;
  }
  .ChatMessage:hover .bce-line-icon-wrapper,
  .ChatMessage:focus .bce-line-icon-wrapper,
  .ChatMessage:focus-within .bce-line-icon-wrapper {
    display: inline;
  }
  .bce-line-icon {
    height: 1em;
    vertical-align: middle;
  }
  #bce-instant-messenger {
    display: flex;
    z-index: 100;
    position: fixed;
    width: 80%;
    height: 70%;
    top: 5%;
    left: 10%;
    padding: 0;
    margin: 0;
    flex-direction: row;
    background-color: #111;
    color: #eee;
    border: 0.2em solid white;
    resize: both;
    overflow: auto;
    max-width: 80%;
    max-height: 75%;
    min-width: 38%;
    min-height: 30%;
    overflow-wrap: break-word;
  }
  #bce-friend-list {
    width: 100%;
    overflow-x: hidden;
    overflow-y: scroll;
  }
  .bce-friend-list-entry {
    padding: 1em;
  }
  .bce-friend-list-entry-name {
    font-weight: bold;
    display: flex;
    flex-direction: column;
  }
  .bce-friend-list-selected {
    font-style: italic;
    border-top: 0.1em solid white;
    border-bottom: 0.1em solid white;
    background-color: #222;
  }
  #bce-message-container {
    width: 100%;
    height: 90%;
    font-size: 1.5rem;
    font-family: Arial, sans-serif;
  }
  #bce-message-right-container {
    width: 80%;
    display: flex;
    flex-direction: column;
    border-left: 0.1em solid white;
  }
  #bce-message-input {
    width: 100%;
    height: 10%;
    border: 0;
    padding: 0;
    margin: 0;
    background-color: #222;
    color: #eee;
    font-size: 1.5rem;
  }
  .bce-friend-list-unread {
    background-color: #a22;
  }
  .bce-message-divider {
    margin: 0.5em 2em;
    border-bottom: 0.2em solid white;
  }
  .bce-message {
    padding: 0.2em 0.4em;
    position: relative;
    white-space: pre-wrap;
  }
  .bce-message::before {
    content: attr(data-time);
    float: right;
    color: gray;
    font-size: 0.5em;
    margin-right: 0.2em;
    font-style: italic;
  }
  .bce-message-sender {
    text-shadow: 0.05em 0.05em #eee;
    font-weight: bold;
  }
  .bce-message-Emote, .bce-message-Action {
    font-style: italic;
    color: gray;
  }
  .bce-message-Message .bce-message-sender {
    text-shadow: 0.05em 0.05em #eee;
  }
  .bce-friend-history {
    overflow-y: scroll;
    overflow-x: hidden;
    height: 100%;
  }
  .bce-friend-list-handshake-false,
  .bce-friend-list-handshake-pending {
    text-decoration: line-through;
    color: gray;
  }
  #bce-message-left-container {
    display: flex;
    flex-direction: column;
    width: 20%;
    height: 100%;
  }
  #bce-friend-search {
    border: 0;
    border-bottom: 0.1em solid white;
    padding: 0.5em;
    height: 1em;
    background-color: #222;
    color: #eee;
  }
  .bce-profile-open {
    margin-right: 0.5em;
  }
  .bce-pending {
    opacity: 0.4;
  }

  .lds-ellipsis {
    display: inline-block;
    position: relative;
    width: 80px;
    height: 1em;
  }
  .lds-ellipsis div {
    position: absolute;
    top: 44%;
    width: 13px;
    height: 13px;
    border-radius: 50%;
    background: #fff;
    animation-timing-function: cubic-bezier(0, 1, 1, 0);
  }
  .lds-ellipsis div:nth-child(1) {
    left: 8px;
    animation: lds-ellipsis1 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(2) {
    left: 8px;
    animation: lds-ellipsis2 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(3) {
    left: 32px;
    animation: lds-ellipsis2 0.6s infinite;
  }
  .lds-ellipsis div:nth-child(4) {
    left: 56px;
    animation: lds-ellipsis3 0.6s infinite;
  }
  @keyframes lds-ellipsis1 {
    0% {
      transform: scale(0);
    }
    100% {
      transform: scale(1);
    }
  }
  @keyframes lds-ellipsis3 {
    0% {
      transform: scale(1);
    }
    100% {
      transform: scale(0);
    }
  }
  @keyframes lds-ellipsis2 {
    0% {
      transform: translate(0, 0);
    }
    100% {
      transform: translate(24px, 0);
    }
  }

  #bceNoteInput {
    z-index: 100 !important;
  }

  #layering {
    overflow-y: auto;
    grid-template:
      "asset-header button-grid" min-content
      "asset-grid asset-grid" min-content
      "layer-header layer-header" min-content
      "layer-grid layer-grid" auto
      "layer-hide-header layer-hide-header" min-content
      "layer-hide-grid layer-hide-grid" auto
      / auto min-content
    ;
  }
  #layering-layer-div {
    overflow-y: visible;
  }
  #layering-button-grid {
    top: 0;
    position: sticky;
  }
  .layering-button-container {
    position: relative;
  }
  #layering-hide-header {
    grid-area: layer-hide-header;
  }
  #layering-hide-div {
    grid-area: layer-hide-grid;
  }
  `;
  const head = document.head || document.getElementsByTagName("head")[0];
  const style = document.createElement("style");
  style.appendChild(document.createTextNode(css));
  head.appendChild(style);
}
