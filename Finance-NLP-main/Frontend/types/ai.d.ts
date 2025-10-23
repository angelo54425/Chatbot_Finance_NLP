declare module "ai" {
  export function useChat(options?: any): {
    messages: any[];
    input: string;
    setInput: (v: string) => void;
    append: (m: any) => void;
  };
  export default { useChat: useChat };
}