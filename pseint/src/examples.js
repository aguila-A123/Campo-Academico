export const examples = {
  'Bienvenida': `Algoritmo Bienvenida
    Definir nombre Como Caracter

    Escribir "¿Cómo te llamas?"
    Leer nombre

    Escribir "Hola, ", nombre, "."
    Escribir "¡Bienvenido a PSeInt!"
FinAlgoritmo`,
  'Mayor de edad': `Algoritmo MayorDeEdad
    Definir edad Como Entero

    Escribir "¿Cuántos años tienes?"
    Leer edad

    Si edad >= 18 Entonces
        Escribir "Eres mayor de edad."
    SiNo
        Escribir "Eres menor de edad."
    FinSi
FinAlgoritmo`,
  'Tabla de multiplicar': `Algoritmo Tabla
    Definir numero, i Como Entero
    Escribir "Introduce un número:"
    Leer numero
    Para i <- 1 Hasta 10 Hacer
        Escribir numero, " x ", i, " = ", numero * i
    FinPara
FinAlgoritmo`,
  'Arreglos y subprocesos': `SubProceso resultado <- Doble(valor)
    Definir resultado Como Entero
    resultado <- valor * 2
FinSubProceso

Algoritmo Arreglos
    Definir numeros, i Como Entero
    Dimension numeros[3]
    Para i <- 1 Hasta 3 Hacer
        numeros[i] <- Doble(i)
        Escribir "Posición ", i, ": ", numeros[i]
    FinPara
FinAlgoritmo`,
  'Menú con Según': `Algoritmo Menu
    Definir opcion Como Entero
    Repetir
        Escribir "1. Saludar / 2. Despedirse / 0. Salir"
        Leer opcion
        Segun opcion Hacer
            1:
                Escribir "¡Hola!"
            2:
                Escribir "¡Hasta luego!"
            De Otro Modo:
                Escribir "Opción: ", opcion
        FinSegun
    Hasta Que opcion = 0
FinAlgoritmo`
};
