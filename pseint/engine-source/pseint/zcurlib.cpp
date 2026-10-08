#include <emscripten.h>
#include <cstdlib>
EM_ASYNC_JS(char*, campus_read_line, (int key), { return await Module.readLine(key); });
#include "global.h"
#include <iostream>
using namespace std;

void lnx_setBackColor(int color);	
void lnx_setForeColor(int color);
void lnx_clrscr();
void lnx_gotoXY(int x, int y);
int lnx_getKey(void);
void lnx_hideCursor();
void lnx_showCursor();
void lnx_setTitle(const char* title);
void win_setBackColor(int color);	
void win_setForeColor(int color);
void win_clrscr();
void win_gotoXY(int x, int y);
int win_getKey(void);
void win_hideCursor();
void win_showCursor();
void win_setTitle(const char* title);


void setBackColor(int color) {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_setBackColor(color);
	else
#endif
		lnx_setBackColor(color);
}

void setForeColor(int color) {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_setForeColor(color);
	else
#endif
		lnx_setForeColor(color);
}

void clrscr() {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_clrscr();
	else
#endif
		lnx_clrscr();
}

void gotoXY(int x, int y) {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_gotoXY(x,y);
	else
#endif
		lnx_gotoXY(x,y);	
}

int getKey(void) {
	if (for_pseint_terminal) {
		cout<<"\033[zk"<<flush;
        char *p=campus_read_line(1); int c=p[0]; free(p); return c;
	} else {
#ifdef __WIN32__
		return win_getKey();
#else
		return lnx_getKey();
#endif
	}
}

void hideCursor() {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_hideCursor();
	else
#endif
		lnx_showCursor();	
}
void showCursor() {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_showCursor();
	else
#endif
		lnx_showCursor();
}

void setTitle(const char* title) {
#ifdef __WIN32__
	if (!for_pseint_terminal)
		win_setTitle(title);
	else
#endif
		lnx_setTitle(title);	
}

string getLine() {
	if (for_pseint_terminal) cout<<"\033[zl";
	cout<<flush; char *p=campus_read_line(0); string s(p); free(p); return s;
}
