// Simple singleton store for managing native errors outside of React lifecycle
// Requirement: 79, 83

export interface NativeError {
    id: string;
    code: string;
    message: string;
    timestamp: number;
    retry?: () => Promise<void>;
    retryable: boolean;
}

type Listener = (errors: NativeError[]) => void;

class NativeErrorStore {
    private errors: NativeError[] = [];
    private listeners: Set<Listener> = new Set();

    public addError(error: Omit<NativeError, "id" | "timestamp">) {
        const newError: NativeError = {
            ...error,
            id: crypto.randomUUID(),
            timestamp: Date.now(),
        };
        this.errors.push(newError);
        this.notify();
        return newError.id;
    }

    public removeError(id: string) {
        this.errors = this.errors.filter(e => e.id !== id);
        this.notify();
    }

    public getErrors() {
        return this.errors;
    }

    public subscribe(listener: Listener) {
        this.listeners.add(listener);
        return () => this.listeners.delete(listener);
    }

    private notify() {
        this.listeners.forEach(listener => listener(this.errors));
    }
}

export const nativeErrorStore = new NativeErrorStore();
