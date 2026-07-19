/* =====================================
   Rifa con Causa
   Karla Villagrana
===================================== */

const tablero = document.getElementById("tableroNumeros");

// Número de WhatsApp
const telefono = "526864257896";

// Estados disponibles:
// disponible
// apartado
// vendido

const numeros = [];

for(let i=1;i<=500;i++){

    numeros.push({
        numero:i,
        estado:"disponible"
    });

}

dibujarTablero();

function dibujarTablero(){

    tablero.innerHTML="";

    numeros.forEach(item=>{

        const boton=document.createElement("button");

        boton.classList.add("numero");

        boton.innerHTML=item.numero.toString().padStart(3,"0");

        switch(item.estado){

            case "disponible":
                boton.classList.add("disponible");
            break;

            case "apartado":
                boton.classList.add("apartado");
                boton.disabled=true;
            break;

            case "vendido":
                boton.classList.add("vendido");
                boton.disabled=true;
            break;

        }

        boton.onclick=()=>{

            reservarNumero(item.numero);

        };

        tablero.appendChild(boton);

    });

}

function reservarNumero(numero){

    const mensaje=
`Hola Karla 👋

Me interesa participar en la Rifa con Causa.

Quiero apartar el número ${numero}.

Quedo atento(a) a tu confirmación.

Gracias.`;

    const url=`https://wa.me/${telefono}?text=${encodeURIComponent(mensaje)}`;

    window.open(url,"_blank");

}
