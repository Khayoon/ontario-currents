"""Optional compiled implementation of the NumPy reference equations.

No fast-math transformations: compare this kernel to the reference before use.
"""
from pathlib import Path
import sys
sys.path.insert(0,str(Path(__file__).resolve().parent/'python-deps'))
from numba import njit
import numpy as np
import math

@njit(cache=True)
def rhs(eta,u,v,H,Hu,Hv,invHu,invHv,invHcorner,dx,dy,f,drag,wind_drag,wx,wy):
    ny,nx=H.shape;U=Hu*u;V=Hv*v
    dEta=np.zeros_like(eta);dU=np.zeros_like(u);dV=np.zeros_like(v)
    Ucorner=np.zeros_like(invHcorner);Vcorner=np.zeros_like(invHcorner)
    for j in range(ny):
        for i in range(nx+1):
            Ucorner[j,i]+=.5*U[j,i];Ucorner[j+1,i]+=.5*U[j,i]
    for j in range(ny+1):
        for i in range(nx):
            Vcorner[j,i]+=.5*V[j,i];Vcorner[j,i+1]+=.5*V[j,i]
    ws=math.hypot(wx,wy)
    tx=1.225*wind_drag*ws*wx/1000.;ty=1.225*wind_drag*ws*wy/1000.
    for j in range(ny):
        for i in range(nx):
            if H[j,i]>0:
                dEta[j,i]=-((U[j,i+1]-U[j,i])/dx+(V[j+1,i]-V[j,i])/dy)
        for i in range(1,nx):
            if Hu[j,i]>0:
                cross=.5*(Vcorner[j,i]*invHcorner[j,i]+Vcorner[j+1,i]*invHcorner[j+1,i])
                dU[j,i]=-9.80665*(eta[j,i]-eta[j,i-1])/dx+f*cross+(tx-drag*math.hypot(u[j,i],cross)*u[j,i])*invHu[j,i]
    for j in range(1,ny):
        for i in range(nx):
            if Hv[j,i]>0:
                cross=.5*(Ucorner[j,i]*invHcorner[j,i]+Ucorner[j,i+1]*invHcorner[j,i+1])
                dV[j,i]=-9.80665*(eta[j,i]-eta[j-1,i])/dy-f*cross+(ty-drag*math.hypot(v[j,i],cross)*v[j,i])*invHv[j,i]
    return dEta,dU,dV

@njit(cache=True)
def step(eta,u,v,H,Hu,Hv,invHu,invHv,invHcorner,dx,dy,f,drag,wind_drag,t,delta,wt,wu,wv):
    wx=np.interp(t,wt,wu);wy=np.interp(t,wt,wv)
    k=rhs(eta,u,v,H,Hu,Hv,invHu,invHv,invHcorner,dx,dy,f,drag,wind_drag,wx,wy)
    ae=eta+delta*k[0];au=u+delta*k[1];av=v+delta*k[2]
    wx=np.interp(t+delta,wt,wu);wy=np.interp(t+delta,wt,wv)
    k=rhs(ae,au,av,H,Hu,Hv,invHu,invHv,invHcorner,dx,dy,f,drag,wind_drag,wx,wy)
    be=.75*eta+.25*(ae+delta*k[0]);bu=.75*u+.25*(au+delta*k[1]);bv=.75*v+.25*(av+delta*k[2])
    wx=np.interp(t+.5*delta,wt,wu);wy=np.interp(t+.5*delta,wt,wv)
    k=rhs(be,bu,bv,H,Hu,Hv,invHu,invHv,invHcorner,dx,dy,f,drag,wind_drag,wx,wy)
    return eta/3+2*(be+delta*k[0])/3,u/3+2*(bu+delta*k[1])/3,v/3+2*(bv+delta*k[2])/3
