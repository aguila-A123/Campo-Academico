using System;
using System.Runtime.InteropServices;

namespace JavaNoir {
    [ComImport, Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IShellItem {
        void BindToHandler(IntPtr context, ref Guid handler, ref Guid iid, out IntPtr value);
        void GetParent(out IShellItem parent);
        void GetDisplayName(uint nameType, out IntPtr name);
        void GetAttributes(uint mask, out uint attributes);
        void Compare(IShellItem other, uint hint, out int order);
    }
    [ComImport, Guid("42F85136-DB7E-439C-85F1-E4075D135FC8"), InterfaceType(ComInterfaceType.InterfaceIsIUnknown)]
    interface IFileDialog {
        [PreserveSig] int Show(IntPtr owner);
        void SetFileTypes(uint count, IntPtr filters);
        void SetFileTypeIndex(uint index);
        void GetFileTypeIndex(out uint index);
        void Advise(IntPtr events, out uint cookie);
        void Unadvise(uint cookie);
        void SetOptions(uint options);
        void GetOptions(out uint options);
        void SetDefaultFolder(IShellItem folder);
        void SetFolder(IShellItem folder);
        void GetFolder(out IShellItem folder);
        void GetCurrentSelection(out IShellItem item);
        void SetFileName([MarshalAs(UnmanagedType.LPWStr)] string name);
        void GetFileName(out IntPtr name);
        void SetTitle([MarshalAs(UnmanagedType.LPWStr)] string title);
        void SetOkButtonLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void SetFileNameLabel([MarshalAs(UnmanagedType.LPWStr)] string label);
        void GetResult(out IShellItem result);
        void AddPlace(IShellItem item, uint alignment);
        void SetDefaultExtension([MarshalAs(UnmanagedType.LPWStr)] string extension);
        void Close(int result);
        void SetClientGuid(ref Guid guid);
        void ClearClientData();
        void SetFilter(IntPtr filter);
    }
    public static class FolderPicker {
        delegate bool WindowVisitor(IntPtr window, IntPtr parameter);
        [DllImport("user32.dll")] static extern bool EnumWindows(WindowVisitor visitor, IntPtr parameter);
        [DllImport("user32.dll")] static extern uint GetWindowThreadProcessId(IntPtr window, out uint process);
        [DllImport("user32.dll")] static extern bool IsWindowVisible(IntPtr window);
        [DllImport("user32.dll")] static extern bool SetWindowPos(IntPtr window, IntPtr after, int x, int y, int width, int height, uint flags);
        [DllImport("user32.dll")] static extern bool SetForegroundWindow(IntPtr window);
        static IntPtr promoted = IntPtr.Zero;
        public static void PromoteWindows() {
            uint own = (uint)System.Diagnostics.Process.GetCurrentProcess().Id;
            EnumWindows(delegate(IntPtr window, IntPtr parameter) {
                uint process; GetWindowThreadProcessId(window, out process);
                if (process == own && IsWindowVisible(window)) {
                    SetWindowPos(window, new IntPtr(-1), 0, 0, 0, 0, 0x1 | 0x2 | 0x10);
                    if (promoted != window) { SetForegroundWindow(window); promoted = window; }
                }
                return true;
            }, IntPtr.Zero);
        }
        [DllImport("shell32.dll", CharSet = CharSet.Unicode, PreserveSig = false)]
        static extern void SHCreateItemFromParsingName(string path, IntPtr context, ref Guid iid, [MarshalAs(UnmanagedType.Interface)] out IShellItem item);
        public static bool Probe() {
            object dialog = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")));
            try { ((IFileDialog)dialog).SetOptions(0x20 | 0x40 | 0x800 | 0x8 | 0x2000000); return true; }
            finally { Marshal.ReleaseComObject(dialog); }
        }
        public static string Pick(IntPtr owner, string title) {
            object instance = Activator.CreateInstance(Type.GetTypeFromCLSID(new Guid("DC1C5A9C-E88A-4DDE-A5A1-60F82A20AEF7")));
            var dialog = (IFileDialog)instance;
            try {
                // Common Explorer dialog: address bar, sidebar, search and New Folder.
                dialog.SetOptions(0x20 | 0x40 | 0x800 | 0x8 | 0x2000000);
                dialog.SetTitle(title);
                dialog.SetOkButtonLabel("Seleccionar carpeta");
                Guid iid = new Guid("43826D1E-E718-42EE-BC55-A1E261C37BFE");
                IShellItem desktop;
                SHCreateItemFromParsingName(Environment.GetFolderPath(Environment.SpecialFolder.DesktopDirectory), IntPtr.Zero, ref iid, out desktop);
                try { dialog.SetDefaultFolder(desktop); } finally { Marshal.ReleaseComObject(desktop); }
                int result = dialog.Show(owner);
                if (result == unchecked((int)0x800704C7)) return null;
                if (result < 0) Marshal.ThrowExceptionForHR(result);
                IShellItem item;
                dialog.GetResult(out item);
                try {
                    IntPtr value;
                    item.GetDisplayName(0x80058000, out value);
                    try { return Marshal.PtrToStringUni(value); }
                    finally { Marshal.FreeCoTaskMem(value); }
                } finally { Marshal.ReleaseComObject(item); }
            } finally { Marshal.ReleaseComObject(instance); }
        }
    }
}
