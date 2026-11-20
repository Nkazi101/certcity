import { useState } from "react";
import type { ReactNode, RefObject } from "react";
import { dispatchConversation, previewConversations } from "../lib/city-dialogue";
import type { PlaceId } from "../lib/world";
import { ConversationAction, ConversationFrame } from "./city-conversation";

type Dialog = RefObject<HTMLDialogElement | null>;

export function DispatchConversation({ dialog, onClose, onSystem, moduleProgress }: {
  dialog: Dialog;
  onClose: () => void;
  onSystem: () => void;
  moduleProgress: ReactNode;
}) {
  const [beat, setBeat] = useState(0);
  const speaker = dispatchConversation[beat];
  const next = dispatchConversation[beat + 1];
  return (
    <ConversationFrame dialog={dialog} title="The missing shipment" {...speaker} step={beat} onClose={onClose} moduleProgress={moduleProgress}>
      <p className="conversation-line" role="status" tabIndex={-1}>{speaker.line}</p>
      <div className="conversation-actions">
        {beat > 0 && <ConversationAction onClick={() => setBeat(beat - 1)}>Back</ConversationAction>}
        {next ? <ConversationAction primary onClick={() => setBeat(beat + 1)}>{next.question}</ConversationAction> :
          <ConversationAction primary onClick={() => { dialog.current?.close(); onSystem(); }}>Open order lookup</ConversationAction>}
      </div>
    </ConversationFrame>
  );
}

export function PlaceConversation({ dialog, place, onClose, library }: {
  dialog: Dialog;
  place: { id: PlaceId; person: string; role: string; name: string; activity: string; example: string };
  onClose: () => void;
  library?: { complete: boolean; action: string; onContinue: () => void };
}) {
  const [asked, setAsked] = useState(false);
  const authored = previewConversations[place.id as keyof typeof previewConversations];
  return (
    <ConversationFrame dialog={dialog} title={place.name} name={place.person} role={place.role} portrait={authored?.portrait} step={Number(asked)} onClose={onClose}>
      <p className="conversation-line" role="status" tabIndex={-1}>{library?.complete
        ? asked ? "Here’s the south front from Olive Street. The date and photographer are on the label now, and visitors can look up the record for themselves."
          : "The reference desk is open. I put the documented photo on the steps so visitors can see where it was taken."
        : asked ? authored?.evidence ?? place.example : authored?.greeting ?? place.activity}</p>
      {asked && library && <figure className="archive-photo">
        <img src="/models/olive-corner/central-library-south-1986.webp" width={525} height={308}
          alt="Black-and-white photograph of Central Library from Olive Street, showing its broad staircase and three entrance arches." />
        <figcaption>
          <strong>Central Library from Olive Street</strong>
          <span>Jack E. Boucher, April–May 1986</span>
          <a href="https://www.loc.gov/resource/hhh.mo1087.photos/" target="_blank" rel="noreferrer">Library of Congress · HABS MO-1835</a>
        </figcaption>
      </figure>}
      <div className="conversation-actions">
        {asked ? <>
          {library && <ConversationAction primary onClick={() => { dialog.current?.close(); library.onContinue(); }}>{library.action}</ConversationAction>}
          <ConversationAction primary={!library} onClick={() => dialog.current?.close()}>Thanks, I’ll look around</ConversationAction>
        </> : <ConversationAction primary onClick={() => setAsked(true)}>{library ? "Show me the photo" : "Tell me more"}</ConversationAction>}
      </div>
    </ConversationFrame>
  );
}
