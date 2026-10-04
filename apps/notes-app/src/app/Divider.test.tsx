// @vitest-environment jsdom
import {cleanup,fireEvent,render,screen} from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import {useRef} from "react";
import {afterEach,expect,it} from "vitest";
import {Divider} from "./Divider";
function Harness(){const panes=useRef<HTMLDivElement>(null);return <div ref={panes}><Divider panes={panes}/></div>;}
afterEach(cleanup);
it("supports keyboard resizing, limits and reset",async()=>{
 const user=userEvent.setup();render(<Harness/>);const divider=screen.getByRole("separator");await user.tab();expect(divider).toHaveFocus();
 await user.keyboard("{ArrowRight}");expect(divider).toHaveAttribute("aria-valuenow","52");
 await user.keyboard("{End}{ArrowRight}");expect(divider).toHaveAttribute("aria-valuenow","80");
 await user.keyboard("{Home}{ArrowLeft}");expect(divider).toHaveAttribute("aria-valuenow","20");
 await user.keyboard("{Enter}");expect(divider).toHaveAttribute("aria-valuenow","50");
});
it("cleans up drag styling if the split is closed during a drag",()=>{
 const {unmount}=render(<Harness/>);fireEvent.mouseDown(screen.getByRole("separator"));expect(document.body.style.userSelect).toBe("none");unmount();expect(document.body.style.userSelect).toBe("");expect(document.body.style.cursor).toBe("");
});
it("drags with the mouse: the divider writes the share of the panes' width it was moved to",()=>{
 // The symptom reported was "the pointer changes, and dragging does nothing".
 // This is the half of that which is JavaScript, and it works — the half that
 // did not is the stylesheet, which is checked in RemoteEditor.test.tsx against
 // the DOM the application really renders. jsdom has no layout, so the panes'
 // box is given.
 render(<Harness/>);
 const panes=screen.getByRole("separator").parentElement as HTMLElement;
 panes.getBoundingClientRect=()=>({left:100,width:1000,top:0,right:1100,bottom:0,height:0,x:100,y:0,toJSON(){}}) as DOMRect;
 fireEvent.mouseDown(screen.getByRole("separator"),{clientX:600});
 fireEvent.mouseMove(document,{clientX:400});          // (400 - 100) / 1000
 expect(panes.style.getPropertyValue("--split")).toBe("30%");
 fireEvent.mouseMove(document,{clientX:900});          // 80% is the limit, not 90
 expect(panes.style.getPropertyValue("--split")).toBe("80%");
 fireEvent.mouseUp(document);
 fireEvent.mouseMove(document,{clientX:200});          // released: no longer follows
 expect(panes.style.getPropertyValue("--split")).toBe("80%");
});
