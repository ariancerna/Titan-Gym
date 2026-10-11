-- Solo recursos visuales de las seis clases académicas; no altera reservas ni roles.
-- Versión local alineada con el historial del proyecto alojado.
-- Conserva las imágenes que un operador haya personalizado por otro camino.
update public.classes set image_url='/assets/generated/spinning.jpg'
where id='40000000-0000-4000-8000-000000000001' and image_url='/assets/1-758/asset-0.png';
update public.classes set featured_image_url='/assets/generated/spinning.jpg'
where id='40000000-0000-4000-8000-000000000001' and featured_image_url='/assets/homeDesign/asset-1.png';
update public.classes set image_url='/assets/generated/hiit.jpg'
where id='40000000-0000-4000-8000-000000000002' and image_url='/assets/homeDesign/asset-2.png';
update public.classes set image_url='/assets/generated/funcional.jpg'
where id='40000000-0000-4000-8000-000000000003' and image_url='/assets/homeDesign/asset-3.png';
update public.classes set image_url='/assets/generated/zumba.jpg'
where id='40000000-0000-4000-8000-000000000004' and image_url is null;
update public.classes set image_url='/assets/generated/yoga.jpg'
where id='40000000-0000-4000-8000-000000000005' and image_url is null;
update public.classes set image_url='/assets/generated/cross-training.jpg'
where id='40000000-0000-4000-8000-000000000006' and image_url is null;
