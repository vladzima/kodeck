use tauri::Manager;
use std::sync::Mutex;
use std::process::Command;

struct SidecarState {
    child: Mutex<Option<std::process::Child>>,
}

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .setup(|app| {
            // In dev mode, the server is started by beforeDevCommand.
            // In release mode, spawn the sidecar binary.
            if !cfg!(debug_assertions) {
                let exe_dir = std::env::current_exe()
                    .expect("failed to get current exe path")
                    .parent()
                    .expect("exe has no parent dir")
                    .to_path_buf();

                let sidecar_path = exe_dir.join("kodeck-server");

                let child = Command::new(&sidecar_path)
                    .spawn()
                    .expect("failed to spawn sidecar");

                app.manage(SidecarState {
                    child: Mutex::new(Some(child)),
                });
            } else {
                println!("[tauri] Dev mode — expecting server at ws://localhost:3001");
                app.manage(SidecarState {
                    child: Mutex::new(None),
                });
            }

            Ok(())
        })
        .build(tauri::generate_context!())
        .expect("error while building tauri application")
        .run(|app, event| {
            if let tauri::RunEvent::Exit = event {
                if let Some(state) = app.try_state::<SidecarState>() {
                    if let Ok(mut child) = state.child.lock() {
                        if let Some(mut child) = child.take() {
                            let _ = child.kill();
                        }
                    }
                }
            }
        });
}
