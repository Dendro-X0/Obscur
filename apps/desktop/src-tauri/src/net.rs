use std::sync::Mutex;

pub struct NetState {
    enable_tor: Mutex<bool>,
    proxy_url: Mutex<String>,
}

impl NetState {
    pub fn new(enable_tor: bool, proxy_url: String) -> Self {
        Self {
            enable_tor: Mutex::new(enable_tor),
            proxy_url: Mutex::new(proxy_url),
        }
    }

    pub fn set(&self, enable_tor: bool, proxy_url: String) {
        let mut tor_guard = self.enable_tor.lock().unwrap();
        *tor_guard = enable_tor;
        let mut proxy_guard = self.proxy_url.lock().unwrap();
        *proxy_guard = proxy_url;
    }

    pub fn is_tor_enabled(&self) -> bool {
        *self.enable_tor.lock().unwrap()
    }

    pub fn get_proxy_url(&self) -> String {
        self.proxy_url.lock().unwrap().clone()
    }
}
