// Minimal Chrome Extension API type definitions for DeskTab

declare namespace chrome {
  namespace tabs {
    interface Tab {
      id?: number;
      title?: string;
      url?: string;
      favIconUrl?: string;
      active: boolean;
      windowId: number;
      index: number;
    }

    interface QueryInfo {
      active?: boolean;
      currentWindow?: boolean;
    }

    interface UpdateProperties {
      active?: boolean;
    }

    interface MoveProperties {
      windowId?: number;
      index: number;
    }

    function query(queryInfo: QueryInfo): Promise<Tab[]>;
    function remove(tabIds: number | number[]): Promise<void>;
    function update(tabId: number, updateProperties: UpdateProperties): Promise<Tab>;
    function move(tabIds: number | number[], moveProperties: MoveProperties): Promise<Tab | Tab[]>;
    function sendMessage(tabId: number, message: any): void;

    const onRemoved: {
      addListener(callback: (tabId: number) => void): void;
    };
  }

  namespace windows {
    interface UpdateInfo {
      focused?: boolean;
    }

    function update(windowId: number, updateInfo: UpdateInfo): Promise<chrome.windows.Window>;

    interface Window {
      id?: number;
      focused: boolean;
    }
  }

  namespace scripting {
    interface ScriptInjection {
      target: { tabId: number };
      files?: string[];
    }

    function executeScript(injection: ScriptInjection): Promise<any>;
  }

  namespace runtime {
    function getURL(path: string): string;
    function sendMessage(message: any): void;

    const onMessage: {
      addListener(
        callback: (
          message: any,
          sender: { tab?: chrome.tabs.Tab },
          sendResponse: (response?: any) => void
        ) => boolean | void
      ): void;
    };
  }

  namespace commands {
    const onCommand: {
      addListener(callback: (command: string) => void): void;
    };
  }

  namespace action {
    const onClicked: {
      addListener(callback: (tab: chrome.tabs.Tab) => void): void;
    };
  }
}
