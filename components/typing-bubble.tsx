import Image from "next/image";
import { cn } from "@/lib/utils";
import { Logo } from "./logo";

interface TypingBubbleProps {
  senderName?: string;
  isMobileView?: boolean;
}

const typingAnimation = `
@keyframes blink {
  0% { opacity: 0.3; }
  20% { opacity: 1; }
  100% { opacity: 0.3; }
}
`;

export function TypingBubble({ senderName = "Supermemory", isMobileView = false }: TypingBubbleProps) {
  return (
    <div className="flex items-start gap-2 px-4 py-2 animate-in fade-in slide-in-from-bottom-2 duration-300">
      {/* Avatar with logo */}
      <div className="w-8 h-8 rounded-full bg-gradient-to-br from-purple-500 to-blue-500 flex items-center justify-center flex-shrink-0 p-1.5">
        <Logo className="w-full h-full text-white" />
      </div>
      
      {/* Typing bubble */}
      <div className="flex flex-col gap-1 max-w-[75%]">
        {/* Sender name */}
        <div className="text-xs text-gray-500 dark:text-gray-400 px-1">
          {senderName}
        </div>
        
        {/* Bubble with typing dots */}
        <div
          className={cn(
            "relative max-w-[75%] break-words flex-none",
            "bg-gray-100 dark:bg-[#404040] text-gray-900 dark:text-gray-100",
            "rounded-[18px] px-4 py-3"
          )}
        >
          <div className="flex items-center justify-center gap-[4px]">
            <style>{typingAnimation}</style>
            <div
              className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300"
              style={{ animation: "blink 1.4s infinite linear" }}
            />
            <div
              className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300"
              style={{
                animation: "blink 1.4s infinite linear 0.2s",
              }}
            />
            <div
              className="w-2 h-2 rounded-full bg-gray-500 dark:bg-gray-300"
              style={{
                animation: "blink 1.4s infinite linear 0.4s",
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

